import { describe, it, expect } from "vitest";
import { probeAudio } from "../../src/upload/probe";
import { sniffAudio, sniffImage } from "../../src/upload/validation";
import { makeMp3, makeWav, fakeId3Text, randomBytes } from "../helpers/audio";

describe("sniffAudio", () => {
  it("recognizes an MP3 by its frame sync", () => {
    expect(sniffAudio(makeMp3(5))).toEqual({ ext: "mp3", mime: "audio/mpeg" });
  });

  it("recognizes an MP3 behind an ID3 tag", () => {
    expect(sniffAudio(makeMp3(5, true))).toEqual({ ext: "mp3", mime: "audio/mpeg" });
  });

  it("recognizes a WAV", () => {
    expect(sniffAudio(makeWav(5).head)).toEqual({ ext: "wav", mime: "audio/wav" });
  });

  it("returns null for bytes that aren't audio at all", () => {
    expect(sniffAudio(randomBytes(4000))).toBeNull();
  });

  it("is fooled by a text file starting with ID3 — which is why probeAudio exists", () => {
    expect(sniffAudio(fakeId3Text())).toEqual({ ext: "mp3", mime: "audio/mpeg" });
  });
});

describe("probeAudio — MP3", () => {
  it("confirms real frames and derives the duration", () => {
    const buf = makeMp3(180);
    const probe = probeAudio(buf, buf.length);
    expect(probe?.format).toBe("mp3");
    expect(probe?.hasAudioFrames).toBe(true);
    expect(probe?.bitrate).toBe(128_000);
    expect(probe?.sampleRate).toBe(44_100);
    // Frame maths can't land exactly on the requested length; 1% is plenty.
    expect(probe!.duration).toBeGreaterThan(178);
    expect(probe!.duration).toBeLessThan(182);
  });

  it("skips an ID3 tag before looking for frames", () => {
    const buf = makeMp3(180, true);
    const probe = probeAudio(buf, buf.length);
    expect(probe?.hasAudioFrames).toBe(true);
    expect(probe!.duration).toBeGreaterThan(178);
  });

  it("reports no frames for a text file wearing an ID3 header", () => {
    const buf = fakeId3Text();
    const probe = probeAudio(buf, buf.length);
    // This is the gap magic-number sniffing leaves open.
    expect(probe?.hasAudioFrames).toBe(false);
    expect(probe?.duration).toBeNull();
  });

  it("still measures a very short file, so the caller can reject it", () => {
    const buf = makeMp3(3);
    const probe = probeAudio(buf, buf.length);
    expect(probe?.hasAudioFrames).toBe(true);
    expect(probe!.duration).toBeLessThan(5);
  });

  it("needs two consecutive frames, so a stray 0xFF byte isn't a match", () => {
    const junk = randomBytes(4000);
    junk[0] = 0xff;
    junk[1] = 0xfb;
    junk[2] = 0x90;
    junk[3] = 0x00;
    const probe = probeAudio(junk, junk.length);
    expect(probe?.hasAudioFrames).toBe(false);
  });
});

describe("probeAudio — WAV", () => {
  it("derives duration from the fmt byte rate and data size", () => {
    const { head, declaredSize } = makeWav(200);
    const probe = probeAudio(head, declaredSize);
    expect(probe?.format).toBe("wav");
    expect(probe?.hasAudioFrames).toBe(true);
    expect(probe?.channels).toBe(2);
    expect(probe?.sampleRate).toBe(44_100);
    expect(probe!.duration).toBeCloseTo(200, 1);
  });
});

describe("probeAudio — rejection", () => {
  it("returns null for a container it doesn't support", () => {
    expect(probeAudio(randomBytes(4000), 4000)).toBeNull();
  });

  it("returns null for a buffer too small to hold a header", () => {
    expect(probeAudio(Buffer.alloc(4), 4)).toBeNull();
  });
});

describe("sniffImage", () => {
  it("recognizes JPEG, PNG and WebP", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0x00]))?.ext).toBe("jpg");
    expect(
      sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext,
    ).toBe("png");
    const webp = Buffer.alloc(16);
    webp.write("RIFF", 0, "ascii");
    webp.write("WEBP", 8, "ascii");
    expect(sniffImage(webp)?.ext).toBe("webp");
  });

  it("rejects audio bytes offered as a cover image", () => {
    expect(sniffImage(makeMp3(2))).toBeNull();
  });
});
