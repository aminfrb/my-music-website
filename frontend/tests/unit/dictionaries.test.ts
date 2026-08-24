import { describe, it, expect } from "vitest";
import { dictionaries } from "@/i18n/dictionaries";

// Note: duplicate keys and missing translations are already compile errors
// (TS1117 and the `Record<keyof typeof en, string>` type on `fa`). What the
// compiler can't see is what's checked below — blank values, placeholders that
// drift apart between locales, and keys the UI expects at runtime.

describe("dictionaries — locale parity", () => {
  const en = Object.keys(dictionaries.en);
  const fa = Object.keys(dictionaries.fa);

  it("ships both locales", () => {
    expect(en.length).toBeGreaterThan(100);
    expect(fa).toHaveLength(en.length);
  });

  it("has no key present in one locale but missing from the other", () => {
    expect(fa.filter((k) => !en.includes(k))).toEqual([]);
    expect(en.filter((k) => !fa.includes(k))).toEqual([]);
  });

  it("has no blank value in either locale", () => {
    for (const [locale, dict] of Object.entries(dictionaries)) {
      const blank = Object.entries(dict)
        .filter(([, v]) => !v || !String(v).trim())
        .map(([k]) => k);
      expect({ locale, blank }).toEqual({ locale, blank: [] });
    }
  });

  it("keeps interpolation placeholders identical across locales", () => {
    // A {name} that survives in en but is dropped in fa renders a broken string.
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const mismatched = Object.keys(dictionaries.en).filter((key) => {
      const a = placeholders(dictionaries.en[key as keyof typeof dictionaries.en]);
      const b = placeholders(dictionaries.fa[key as keyof typeof dictionaries.fa]);
      return a.join() !== b.join();
    });
    expect(mismatched).toEqual([]);
  });
});

describe("dictionaries — the keys the new UI depends on", () => {
  it.each([
    "sec_forYou",
    "sec_becauseYouFollow",
    "sec_genresFromYourNetwork",
    "sec_fromArtistsYouLike",
    "sec_suggestedUsers",
    "sec_followingFeed",
    "dupTitle",
    "dupUploadedBy",
    "dupSameFile",
    "dupSameSong",
    "dupOpenTrack",
    "dupTryAnother",
    "titleHint",
    "artistNameHint",
    "nameLooksAuto",
    "follow",
    "following_",
    "viewProfile",
  ])("defines %s in both locales", (key) => {
    expect(dictionaries.en).toHaveProperty(key);
    expect(dictionaries.fa).toHaveProperty(key);
  });
});
