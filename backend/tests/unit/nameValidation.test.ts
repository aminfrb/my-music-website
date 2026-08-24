import { describe, it, expect } from "vitest";
import { checkTitle, checkArtistName } from "../../src/upload/nameValidation";

/**
 * The naming rules exist to keep machine-generated names ("8432.mp3") out of
 * the library without rejecting real ones. Both halves matter equally: a rule
 * that blocks "M.I.A" or "سیل" is worse than no rule at all, so the accept
 * cases are as load-bearing as the reject cases.
 */
describe("checkTitle — real song names are accepted", () => {
  const REAL_TITLES = [
    // English
    "Seyl",
    "Bohemian Rhapsody",
    "Numb",
    "24K Magic",
    "7 Rings",
    "Sting",
    "Rhythm",
    "M.I.A",
    "Gym Class Heroes",
    "Man o To",
    "Deltangi",
    "Bi Nam",
    "3 Nafar",
    "Ye",
    "Salam",
    // Persian
    "سیل",
    "مرا ببوس",
    "شب‌های تهران",
    "دلتنگی",
    "هیچ",
    "خدا",
    // Mixed scripts
    "Seyl (سیل)",
  ];

  it.each(REAL_TITLES)("accepts %j", (title) => {
    expect(checkTitle(title)).toEqual({ ok: true });
  });
});

describe("checkTitle — machine names are rejected with a specific reason", () => {
  const CASES: [string, string][] = [
    // The case from the original report.
    ["8432", "errors.nameNeedsLetters"],
    ["8432.mp3", "errors.nameLooksLikeFile"],
    ["song.wav", "errors.nameLooksLikeFile"],
    // Phone / recorder output.
    ["AUD-20240115-WA0007", "errors.nameMachineGenerated"],
    ["VID_20240101", "errors.nameMachineGenerated"],
    ["New Recording 12", "errors.nameMachineGenerated"],
    ["Recording", "errors.nameMachineGenerated"],
    ["track_01", "errors.nameMachineGenerated"],
    ["untitled", "errors.nameMachineGenerated"],
    ["Untitled 3", "errors.nameMachineGenerated"],
    ["copy of xyz", "errors.nameMachineGenerated"],
    ["final", "errors.nameMachineGenerated"],
    ["2024-01-15 12-00", "errors.nameMachineGenerated"],
    // Numbers and encoder noise.
    ["1234567", "errors.nameNeedsLetters"],
    // "kbps" carries no vowel, so the gibberish rule catches this before the
    // digit-density one — either way it never reaches the library.
    ["128kbps", "errors.nameGibberish"],
    ["۱۲۳۴", "errors.nameNeedsLetters"],
    ["3f9a8c7b1e2d4f6a9c8b", "errors.nameMachineGenerated"],
    // Channel promotion pasted into ID3 tags.
    ["http://site.ir/song", "errors.namePromotional"],
    ["www.music.ir", "errors.namePromotional"],
    ["@musicchannel", "errors.namePromotional"],
    // Keyboard mashing.
    ["aaaaaaa", "errors.nameGibberish"],
    ["kjhdfg", "errors.nameGibberish"],
    // Persian equivalents.
    ["بدون نام", "errors.nameMachineGenerated"],
    ["آهنگ 3", "errors.nameMachineGenerated"],
    ["تست", "errors.nameMachineGenerated"],
    // Too short to be anything.
    ["a", "errors.nameTooShort"],
  ];

  it.each(CASES)("rejects %j as %s", (title, reason) => {
    expect(checkTitle(title)).toEqual({ ok: false, reason });
  });
});

describe("checkTitle — other rules", () => {
  it("rejects a script it cannot display or search", () => {
    // Real letters, but neither Latin nor Persian.
    expect(checkTitle("Москва")).toEqual({ ok: false, reason: "errors.nameScript" });
  });

  it("rejects a name longer than the column allows", () => {
    expect(checkTitle("a".repeat(200)).reason).toBe("errors.nameTooLong");
  });

  it("ignores surrounding whitespace", () => {
    expect(checkTitle("   Seyl   ")).toEqual({ ok: true });
  });

  it("rejects a title that is mostly digits", () => {
    expect(checkTitle("ab 123456").reason).toBe("errors.nameNeedsLetters");
  });
});

describe("checkArtistName", () => {
  it.each(["Mehrad Hidden", "مهراد هیدن", "Sasy", "Sirvan Khosravi"])(
    "accepts %j",
    (name) => {
      expect(checkArtistName(name)).toEqual({ ok: true });
    },
  );

  it.each(["unknown", "Various Artists", "artist", "admin"])(
    "rejects the placeholder %j with an artist-specific message",
    (name) => {
      expect(checkArtistName(name)).toEqual({
        ok: false,
        reason: "errors.artistNamePlaceholder",
      });
    },
  );

  it("applies the shared shape rules too", () => {
    expect(checkArtistName("8432").ok).toBe(false);
  });
});
