/**
 * Content-based file-type detection. We never trust the client-supplied
 * filename or MIME type — the real type is sniffed from the leading bytes
 * ("magic numbers"). This is the core of upload security.
 */

export interface SniffResult {
  ext: string;
  mime: string;
}

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function ascii(buf: Buffer, str: string, offset = 0): boolean {
  return startsWith(buf, [...str].map((c) => c.charCodeAt(0)), offset);
}

/** Detect supported audio container/codec from header bytes. */
export function sniffAudio(buf: Buffer): SniffResult | null {
  // MP3 with ID3v2 tag
  if (ascii(buf, "ID3")) return { ext: "mp3", mime: "audio/mpeg" };
  // MP3 frame sync (no ID3 tag): 0xFF followed by 0xE_/0xF_
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    // Could also be ADTS AAC (0xFF 0xF1/0xF9) — accept either as audio.
    if (buf[1] === 0xf1 || buf[1] === 0xf9) return { ext: "aac", mime: "audio/aac" };
    return { ext: "mp3", mime: "audio/mpeg" };
  }
  // WAV: "RIFF"...."WAVE"
  if (ascii(buf, "RIFF") && ascii(buf, "WAVE", 8)) {
    return { ext: "wav", mime: "audio/wav" };
  }
  // FLAC
  if (ascii(buf, "fLaC")) return { ext: "flac", mime: "audio/flac" };
  // OGG (Vorbis/Opus)
  if (ascii(buf, "OggS")) return { ext: "ogg", mime: "audio/ogg" };
  // MP4 / M4A container: bytes 4..7 == "ftyp"
  if (ascii(buf, "ftyp", 4)) {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (/^(M4A|mp4|isom|M4B|dash)/i.test(brand)) {
      return { ext: "m4a", mime: "audio/mp4" };
    }
    return { ext: "m4a", mime: "audio/mp4" };
  }
  return null;
}

/** Detect supported cover-image type from header bytes. */
export function sniffImage(buf: Buffer): SniffResult | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { ext: "jpg", mime: "image/jpeg" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ext: "png", mime: "image/png" };
  }
  // WebP: "RIFF"...."WEBP"
  if (ascii(buf, "RIFF") && ascii(buf, "WEBP", 8)) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

/** Human-readable byte size for error messages, e.g. "50 MB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
