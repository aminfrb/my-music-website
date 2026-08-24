/**
 * Synthetic audio files. Building the containers byte by byte keeps real media
 * out of the repo and lets a test ask for an exact duration, which is the thing
 * the probe is supposed to derive.
 */

/** One 128 kbps, 44.1 kHz, stereo MPEG-1 Layer III frame (417 bytes). */
function mp3Frame(): Buffer {
  const bitrate = 128_000;
  const sampleRate = 44_100;
  const frame = Buffer.alloc(Math.floor((144 * bitrate) / sampleRate));
  frame[0] = 0xff;
  frame[1] = 0xfb; // MPEG-1, Layer III, no CRC
  frame[2] = 0x90; // bitrate index 9 (128k), sample-rate index 0 (44.1k)
  frame[3] = 0x00; // stereo
  return frame;
}

/** A constant-bitrate MP3 of roughly `seconds` length. */
export function makeMp3(seconds: number, withId3 = false): Buffer {
  const frame = mp3Frame();
  const frames = Math.max(1, Math.round((seconds * 44_100) / 1152));
  const parts: Buffer[] = [];
  if (withId3) {
    const tag = Buffer.alloc(110);
    tag.write("ID3", 0, "ascii");
    tag[3] = 3; // version 2.3
    tag[9] = 100; // synchsafe size = 100 bytes of tag body
    parts.push(tag);
  }
  for (let i = 0; i < frames; i++) parts.push(frame);
  return Buffer.concat(parts);
}

/**
 * A WAV header describing `seconds` of audio. Only the header is materialized;
 * `declaredSize` is what a full file would measure, which is what the probe is
 * given as the object size.
 */
export function makeWav(seconds: number): { head: Buffer; declaredSize: number } {
  const sampleRate = 44_100;
  const channels = 2;
  const bits = 16;
  const byteRate = sampleRate * channels * (bits / 8);
  const dataSize = Math.round(byteRate * seconds);

  const head = Buffer.alloc(44);
  head.write("RIFF", 0, "ascii");
  head.writeUInt32LE(36 + dataSize, 4);
  head.write("WAVE", 8, "ascii");
  head.write("fmt ", 12, "ascii");
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(sampleRate, 24);
  head.writeUInt32LE(byteRate, 28);
  head.writeUInt16LE((channels * bits) / 8, 32);
  head.writeUInt16LE(bits, 34);
  head.write("data", 36, "ascii");
  head.writeUInt32LE(dataSize, 40);

  return { head, declaredSize: 44 + dataSize };
}

/** A text file that happens to begin with the ID3 magic bytes. */
export function fakeId3Text(): Buffer {
  return Buffer.from(
    "ID3 this is a plain text file pretending to be audio, with no frames anywhere in it.",
  );
}

export function randomBytes(n: number): Buffer {
  return Buffer.from(Array.from({ length: n }, (_, i) => (i * 37) % 256));
}
