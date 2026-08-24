import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatDuration,
  formatCount,
  formatBytes,
  formatRelativeDate,
  toPersianDigits,
  gradientFromId,
} from "@/lib/format";

afterEach(() => vi.useRealTimers());

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [59, "0:59"],
    [60, "1:00"],
    [125, "2:05"],
    [599, "9:59"],
    [3600, "1:00:00"],
    [3661, "1:01:01"],
    [7325, "2:02:05"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("pads minutes only once an hour is shown", () => {
    expect(formatDuration(305)).toBe("5:05");
    expect(formatDuration(3905)).toBe("1:05:05");
  });

  it("falls back to 0:00 for values a broken audio element can produce", () => {
    // `audio.duration` is NaN until metadata loads, and Infinity for streams.
    expect(formatDuration(NaN)).toBe("0:00");
    expect(formatDuration(Infinity)).toBe("0:00");
    expect(formatDuration(-10)).toBe("0:00");
  });
});

describe("formatCount", () => {
  it.each([
    [0, "0"],
    [7, "7"],
    [999, "999"],
    [1000, "1K"],
    [1234, "1.2K"],
    [12_500, "12.5K"],
    [1_000_000, "1M"],
    [1_500_000, "1.5M"],
  ])("formats %i as %s", (n, expected) => {
    expect(formatCount(n)).toBe(expected);
  });

  it("drops the decimal on a round number", () => {
    expect(formatCount(2000)).toBe("2K");
    expect(formatCount(2100)).toBe("2.1K");
  });

  it("uses Persian digits in fa", () => {
    expect(formatCount(1234, "fa")).toBe("۱.۲K");
    expect(formatCount(42, "fa")).toBe("۴۲");
  });
});

describe("toPersianDigits", () => {
  it("converts digits and leaves everything else alone", () => {
    expect(toPersianDigits("2024 tracks")).toBe("۲۰۲۴ tracks");
    expect(toPersianDigits("no digits")).toBe("no digits");
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1.0 KB"],
    [1536, "1.5 KB"],
    [1_048_576, "1.0 MB"],
    [5_242_880, "5.0 MB"],
    [52_428_800, "50.0 MB"],
  ])("formats %i bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("stops at GB rather than inventing a larger unit", () => {
    expect(formatBytes(5 * 1024 ** 4)).toContain("GB");
  });
});

describe("formatRelativeDate", () => {
  const NOW = new Date("2026-06-15T12:00:00Z");
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  it("describes recent times relatively", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(formatRelativeDate(ago(30_000))).toMatch(/second/);
    expect(formatRelativeDate(ago(5 * 60_000))).toMatch(/minute/);
    expect(formatRelativeDate(ago(3 * 3_600_000))).toMatch(/hour/);
    expect(formatRelativeDate(ago(3 * 86_400_000))).toMatch(/day/);
  });

  it("switches to an absolute date beyond a month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const result = formatRelativeDate(ago(200 * 86_400_000));
    expect(result).toMatch(/2025/);
    expect(result).not.toMatch(/day/);
  });

  it("renders in Persian for fa", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const result = formatRelativeDate(ago(3 * 86_400_000), "fa");
    // Persian output, not the English string.
    expect(result).not.toMatch(/day/);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("gradientFromId", () => {
  it("is deterministic, so a cover-less card doesn't change colour on re-render", () => {
    expect(gradientFromId("abc123")).toBe(gradientFromId("abc123"));
  });

  it("gives different ids different gradients", () => {
    expect(gradientFromId("abc123")).not.toBe(gradientFromId("xyz789"));
  });

  it("always produces a valid CSS gradient", () => {
    for (const id of ["", "a", "507f1f77bcf86cd799439011"]) {
      expect(gradientFromId(id)).toMatch(
        /^linear-gradient\(135deg, hsl\(\d+ \d+% \d+%\), hsl\(\d+ \d+% \d+%\)\)$/,
      );
    }
  });

  it("keeps hues inside the legal range", () => {
    for (let i = 0; i < 200; i++) {
      const hues = [...gradientFromId(`id-${i}`).matchAll(/hsl\((\d+)/g)].map((m) => Number(m[1]));
      for (const h of hues) expect(h).toBeGreaterThanOrEqual(0);
      for (const h of hues) expect(h).toBeLessThan(360);
    }
  });
});
