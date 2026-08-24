/**
 * Audio container probing.
 *
 * Magic-number sniffing (validation.ts) answers "does this start like an MP3?".
 * That is not the same as "is this a playable song": a text file whose first
 * three bytes are "ID3", a 200 ms blip, or a truncated download all pass the
 * sniff. This module goes one level deeper — it decodes the container structure
 * to confirm real audio frames exist and derives the true duration, so the
 * server never has to trust the duration the client reports.
 */

export interface AudioProbe {
  /** Container we actually decoded. */
  format: "mp3" | "wav" | "m4a" | "flac" | "ogg" | "aac";
  /** Seconds, or null when the container puts its timing data out of reach. */
  duration: number | null;
  /** Bits per second, when known. */
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
  /** False when the header parsed but no decodable audio frame was found. */
  hasAudioFrames: boolean;
}

/* --------------------------------- MPEG --------------------------------- */

const MPEG_BITRATES_V1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const MPEG_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

interface MpegFrame {
  offset: number;
  frameLength: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  samplesPerFrame: number;
  versionId: number;
}

/** Parse an MPEG audio frame header at `offset`, or null if it isn't one. */
function parseMpegFrame(buf: Buffer, offset: number): MpegFrame | null {
  if (offset + 4 > buf.length) return null;
  if (buf[offset] !== 0xff || (buf[offset + 1] & 0xe0) !== 0xe0) return null;

  const versionId = (buf[offset + 1] >> 3) & 0x03; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
  const layer = (buf[offset + 1] >> 1) & 0x03; // 1=LayerIII, 2=LayerII, 3=LayerI
  if (versionId === 1 || layer === 0) return null; // reserved

  const bitrateIndex = (buf[offset + 2] >> 4) & 0x0f;
  const sampleRateIndex = (buf[offset + 2] >> 2) & 0x03;
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return null;

  const table = versionId === 3 ? MPEG_BITRATES_V1_L3 : MPEG_BITRATES_V2_L3;
  const bitrate = table[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[versionId]?.[sampleRateIndex];
  if (!bitrate || !sampleRate) return null;

  const padding = (buf[offset + 2] >> 1) & 0x01;
  const channelMode = (buf[offset + 3] >> 6) & 0x03;
  const channels = channelMode === 3 ? 1 : 2;
  // Layer I uses 384 samples/frame; Layer II/III use 1152 (576 for MPEG-2 L3).
  const samplesPerFrame = layer === 3 ? 384 : versionId === 3 ? 1152 : 576;
  const frameLength =
    layer === 3
      ? (Math.floor((12 * bitrate) / sampleRate) + padding) * 4
      : Math.floor((samplesPerFrame / 8) * (bitrate / sampleRate)) + padding;
  if (frameLength < 8) return null;

  return { offset, frameLength, bitrate, sampleRate, channels, samplesPerFrame, versionId };
}

/** Skip an ID3v2 tag if present; returns the offset of the audio data. */
function skipId3(buf: Buffer): number {
  if (buf.length < 10 || buf.toString("ascii", 0, 3) !== "ID3") return 0;
  // Size is a 28-bit synchsafe integer in bytes 6..9.
  const size =
    ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  const footer = (buf[5] & 0x10) !== 0 ? 10 : 0;
  return 10 + size + footer;
}

/**
 * Confirm a real MPEG stream and time it. Handles both VBR (via the Xing/Info
 * frame count) and CBR (via bitrate over the remaining bytes).
 */
function probeMp3(buf: Buffer, totalSize: number): AudioProbe {
  const start = skipId3(buf);
  const empty: AudioProbe = {
    format: "mp3",
    duration: null,
    bitrate: null,
    sampleRate: null,
    channels: null,
    hasAudioFrames: false,
  };

  // Find the first frame, allowing for a little garbage between tag and audio.
  let first: MpegFrame | null = null;
  const scanLimit = Math.min(buf.length - 4, start + 64 * 1024);
  for (let i = Math.max(0, start); i < scanLimit; i++) {
    const candidate = parseMpegFrame(buf, i);
    if (!candidate) continue;
    // A lone 0xFFE byte pattern is common in binary junk — require a second
    // frame to follow at exactly the computed frame length.
    if (parseMpegFrame(buf, i + candidate.frameLength)) {
      first = candidate;
      break;
    }
  }
  if (!first) return empty;

  const audioBytes = totalSize - first.offset;

  // Xing / Info (VBR) header lives inside the first frame, after the side info.
  const sideInfo = first.versionId === 3 ? (first.channels === 1 ? 17 : 32) : first.channels === 1 ? 9 : 17;
  const xingOffset = first.offset + 4 + sideInfo;
  if (xingOffset + 12 <= buf.length) {
    const tag = buf.toString("ascii", xingOffset, xingOffset + 4);
    if (tag === "Xing" || tag === "Info") {
      const flags = buf.readUInt32BE(xingOffset + 4);
      if (flags & 0x01) {
        const frames = buf.readUInt32BE(xingOffset + 8);
        if (frames > 0) {
          const duration = (frames * first.samplesPerFrame) / first.sampleRate;
          return {
            format: "mp3",
            duration,
            bitrate: Math.round((audioBytes * 8) / duration),
            sampleRate: first.sampleRate,
            channels: first.channels,
            hasAudioFrames: true,
          };
        }
      }
    }
  }

  return {
    format: "mp3",
    duration: audioBytes > 0 ? audioBytes / (first.bitrate / 8) : null,
    bitrate: first.bitrate,
    sampleRate: first.sampleRate,
    channels: first.channels,
    hasAudioFrames: true,
  };
}

/* ---------------------------------- WAV ---------------------------------- */

function probeWav(buf: Buffer, totalSize: number): AudioProbe {
  const result: AudioProbe = {
    format: "wav",
    duration: null,
    bitrate: null,
    sampleRate: null,
    channels: null,
    hasAudioFrames: false,
  };
  let offset = 12; // past "RIFF<size>WAVE"
  let byteRate = 0;
  let dataSize = 0;

  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt " && offset + 8 + 16 <= buf.length) {
      result.channels = buf.readUInt16LE(offset + 10);
      result.sampleRate = buf.readUInt32LE(offset + 12);
      byteRate = buf.readUInt32LE(offset + 16);
      result.bitrate = byteRate * 8;
    } else if (id === "data") {
      // A streamed WAV can declare size 0 — fall back to what's left of the file.
      dataSize = size > 0 ? size : totalSize - (offset + 8);
      result.hasAudioFrames = dataSize > 0;
      break;
    }
    offset += 8 + size + (size % 2); // chunks are word-aligned
  }

  if (byteRate > 0 && dataSize > 0) result.duration = dataSize / byteRate;
  return result;
}

/* ---------------------------------- MP4 ---------------------------------- */

/** Walk the MP4 atom tree for `moov > mvhd`, which carries the movie duration. */
function probeM4a(buf: Buffer): AudioProbe {
  const result: AudioProbe = {
    format: "m4a",
    duration: null,
    bitrate: null,
    sampleRate: null,
    channels: null,
    // ftyp already matched an audio brand; frames live in mdat, which we don't walk.
    hasAudioFrames: true,
  };

  const walk = (start: number, end: number, depth: number): boolean => {
    let offset = start;
    while (offset + 8 <= end && depth < 6) {
      const size = buf.readUInt32BE(offset);
      const type = buf.toString("ascii", offset + 4, offset + 8);
      if (size < 8) return false;
      if (type === "mvhd" && offset + 32 <= end) {
        const version = buf[offset + 8];
        const timescale = version === 1 ? buf.readUInt32BE(offset + 28) : buf.readUInt32BE(offset + 20);
        const rawDuration =
          version === 1
            ? Number(buf.readBigUInt64BE(offset + 32))
            : buf.readUInt32BE(offset + 24);
        if (timescale > 0 && rawDuration > 0) {
          result.duration = rawDuration / timescale;
          return true;
        }
      }
      if (type === "moov" || type === "trak" || type === "mdia") {
        if (walk(offset + 8, Math.min(offset + size, end), depth + 1)) return true;
      }
      offset += size;
    }
    return false;
  };

  walk(0, buf.length, 0);
  return result;
}

/**
 * Probe an audio file from its leading bytes. `head` should be the first few
 * hundred KB; `totalSize` the full object size (used for CBR duration math).
 * Returns null when the bytes aren't a container we support.
 */
export function probeAudio(head: Buffer, totalSize: number): AudioProbe | null {
  if (head.length < 12) return null;

  if (head.toString("ascii", 0, 3) === "ID3" || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) {
    // ADTS AAC shares the 0xFF sync — distinguish before treating it as MPEG.
    if (head[0] === 0xff && (head[1] === 0xf1 || head[1] === 0xf9)) {
      return {
        format: "aac",
        duration: null,
        bitrate: null,
        sampleRate: null,
        channels: null,
        hasAudioFrames: true,
      };
    }
    return probeMp3(head, totalSize);
  }
  if (head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WAVE") {
    return probeWav(head, totalSize);
  }
  if (head.toString("ascii", 4, 8) === "ftyp") {
    const brand = head.toString("ascii", 8, 12);
    if (!/^(M4A|M4B|mp4|isom|iso2|dash|avc1|mp42)/i.test(brand)) return null;
    return probeM4a(head);
  }
  if (head.toString("ascii", 0, 4) === "fLaC") {
    return {
      format: "flac",
      duration: null,
      bitrate: null,
      sampleRate: null,
      channels: null,
      hasAudioFrames: true,
    };
  }
  if (head.toString("ascii", 0, 4) === "OggS") {
    return {
      format: "ogg",
      duration: null,
      bitrate: null,
      sampleRate: null,
      channels: null,
      hasAudioFrames: true,
    };
  }
  return null;
}
