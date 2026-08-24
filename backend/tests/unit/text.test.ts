import { describe, it, expect } from "vitest";
import {
  normalizeText,
  normalizeName,
  normalizeTag,
  primaryArtist,
  dedupeKeyFor,
  scriptsOf,
  buildNormalized,
} from "../../src/utils/text";

describe("normalizeText", () => {
  it("folds Arabic character variants onto their Persian forms", () => {
    // Users type these interchangeably; search has to see one word.
    expect(normalizeText("كتاب")).toBe(normalizeText("کتاب"));
    expect(normalizeText("يک")).toBe(normalizeText("یک"));
  });

  it("unifies Persian and Arabic-Indic digits with ASCII", () => {
    expect(normalizeText("۱۲۳")).toBe("123");
    expect(normalizeText("١٢٣")).toBe("123");
  });

  it("lowercases, collapses whitespace and strips the ZWNJ", () => {
    expect(normalizeText("  Hello   World  ")).toBe("hello world");
    expect(normalizeText("شب‌های")).toBe("شب های");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("normalizeName", () => {
  it("drops bracketed decorations", () => {
    expect(normalizeName("Seyl (Official Audio)")).toBe("seyl");
    expect(normalizeName("Numb [Remastered]")).toBe("numb");
  });

  it("drops encoder and download noise", () => {
    expect(normalizeName("Seyl 320")).toBe("seyl");
    expect(normalizeName("دانلود آهنگ سیل")).toBe("سیل");
  });

  it("strips punctuation but keeps letters and digits", () => {
    expect(normalizeName("7 Rings!")).toBe("7 rings");
  });
});

describe("primaryArtist", () => {
  it("ignores featured guests", () => {
    expect(primaryArtist("Mehrad Hidden ft. Sijal")).toBe("mehrad hidden");
    expect(primaryArtist("Mehrad Hidden feat Sijal")).toBe("mehrad hidden");
    expect(primaryArtist("Mehrad Hidden & Sijal")).toBe("mehrad hidden");
    expect(primaryArtist("Mehrad Hidden, Sijal")).toBe("mehrad hidden");
  });

  it("leaves a solo credit alone", () => {
    expect(primaryArtist("Mehrad Hidden")).toBe("mehrad hidden");
  });
});

describe("dedupeKeyFor — song identity", () => {
  const SEYL = "seyl|mehrad hidden";

  it.each([
    ["Seyl", "Mehrad Hidden"],
    ["seyl", "mehrad hidden"],
    ["SEYL", "MEHRAD HIDDEN"],
    ["Seyl (Official Audio)", "Mehrad Hidden"],
    ["Seyl [320]", "Mehrad Hidden ft. Sijal"],
    ["  Seyl  ", " Mehrad Hidden "],
  ])("collapses %j / %j onto the same key", (title, artist) => {
    expect(dedupeKeyFor(title, artist)).toBe(SEYL);
  });

  it("keeps different songs apart", () => {
    // Same title, different artist — a cover is not the same upload.
    expect(dedupeKeyFor("Seyl", "Sasy")).not.toBe(SEYL);
    // Same artist, different song.
    expect(dedupeKeyFor("Deltangi", "Mehrad Hidden")).not.toBe(SEYL);
  });

  it("matches across Arabic/Persian spelling variants", () => {
    expect(dedupeKeyFor("كتاب", "علي")).toBe(dedupeKeyFor("کتاب", "علی"));
  });

  it("returns an empty key when either half is missing, so nothing matches it", () => {
    expect(dedupeKeyFor("Seyl", "")).toBe("");
    expect(dedupeKeyFor("", "Mehrad Hidden")).toBe("");
    expect(dedupeKeyFor(null, null)).toBe("");
  });
});

describe("scriptsOf", () => {
  it("identifies Latin, Persian and both", () => {
    expect(scriptsOf("Seyl")).toEqual({ latin: true, persian: false });
    expect(scriptsOf("سیل")).toEqual({ latin: false, persian: true });
    expect(scriptsOf("Seyl (سیل)")).toEqual({ latin: true, persian: true });
    expect(scriptsOf("1234")).toEqual({ latin: false, persian: false });
  });
});

describe("normalizeTag", () => {
  it("hyphenates a multi-word tag", () => {
    expect(normalizeTag("Boom Bap")).toBe("boom-bap");
  });
});

describe("buildNormalized", () => {
  it("joins the searchable fields, skipping blanks", () => {
    expect(buildNormalized(["Seyl", null, "Mehrad Hidden", undefined])).toBe(
      "seyl mehrad hidden",
    );
  });
});
