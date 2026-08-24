/**
 * Text utilities, primarily for bilingual (Persian/English) search.
 *
 * Persian normalization folds Arabic-vs-Persian character variants that users
 * type interchangeably (ي/ی، ك/ک), unifies digits, strips diacritics and the
 * zero-width non-joiner, and lowercases — so "كتاب" and "کتاب" match.
 */

const ARABIC_TO_PERSIAN: Record<string, string> = {
  "ي": "ی", // ي → ی
  "ى": "ی", // alef maqsura → ی
  "ك": "ک", // ك → ک
  "ة": "ه", // ة → ه
};

const DIGIT_MAP: Record<string, string> = {};
// Persian (۰-۹) and Arabic-Indic (٠-٩) digits → ASCII
"۰۱۲۳۴۵۶۷۸۹".split("").forEach((d, i) => (DIGIT_MAP[d] = String(i)));
"٠١٢٣٤٥٦٧٨٩".split("").forEach((d, i) => (DIGIT_MAP[d] = String(i)));

export function normalizeText(input: string): string {
  if (!input) return "";
  let out = input.normalize("NFC");
  out = out.replace(/[يىكة]/g, (c) => ARABIC_TO_PERSIAN[c] ?? c);
  out = out.replace(/[۰-۹٠-٩]/g, (c) => DIGIT_MAP[c] ?? c);
  out = out.replace(/[ً-ْٰ]/g, ""); // Arabic diacritics/tashkil
  out = out.replace(/‌/g, " "); // ZWNJ → space
  out = out.replace(/\s+/g, " ").trim().toLowerCase();
  return out;
}

/** Build the combined, normalized search blob stored on a Music document. */
export function buildNormalized(parts: (string | null | undefined)[]): string {
  return normalizeText(parts.filter(Boolean).join(" "));
}

/** Normalize a free-form tag into its canonical stored form. */
export function normalizeTag(tag: string): string {
  return normalizeText(tag).replace(/\s+/g, "-");
}

export function randomToken(length = 24): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/* ------------------------------ Name matching ------------------------------ */

/**
 * Decorations that routinely appear in shared MP3 metadata but say nothing
 * about the identity of the track. Removed before duplicate matching so
 * "Seyl (Official Audio) [320]" and "seyl" collapse to the same key.
 */
const TITLE_NOISE = [
  "official audio", "official video", "official music video", "official",
  "lyrics video", "lyric video", "lyrics", "audio only", "audio", "video",
  "full album", "full version", "full", "hq", "hd", "high quality",
  "original mix", "original", "explicit", "clean version", "clean",
  "free download", "download", "exclusive", "new version", "new",
  "320kbps", "320", "256kbps", "256", "192kbps", "192", "128kbps", "128", "kbps",
  "با کیفیت اصلی", "کیفیت اصلی", "با کیفیت", "کیفیت بالا", "دانلود آهنگ",
  "دانلود", "متن آهنگ", "آهنگ جدید", "رسمی", "اورجینال", "ورژن اصلی",
];

/** Separators that introduce a featured artist rather than a new title. */
const FEATURE_SPLIT = /\s(?:ft|feat|featuring|با\s*همراهی|با\s*صدای)\.?\s+/i;

/**
 * Collapse a title or artist name to a comparable form: Persian-folded,
 * lowercased, stripped of punctuation, bracketed decorations, and the common
 * "official / 320 / download" noise words. Used only for matching — never for
 * display.
 */
export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  let out = normalizeText(input);
  // Drop bracketed segments — "(official audio)", "[remix]" stays out of the key.
  out = out.replace(/[\(\[\{（【][^\)\]\}）】]*[\)\]\}）】]/g, " ");
  // Punctuation and symbols → space (keeps Latin letters, Persian/Arabic letters, digits).
  out = out.replace(/[^\p{L}\p{N}]+/gu, " ");
  for (const noise of TITLE_NOISE) {
    out = out.replace(new RegExp(`(^|\\s)${noise}(\\s|$)`, "g"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * The artist a track is credited to, ignoring featured guests — so
 * "Mehrad Hidden ft. Sijal" and "Mehrad Hidden" are recognized as the same
 * primary artist when checking for duplicates.
 */
export function primaryArtist(input: string | null | undefined): string {
  if (!input) return "";
  const [first] = input.split(FEATURE_SPLIT);
  const [head] = (first ?? input).split(/[،,&×+]|\sو\s|\swith\s/i);
  return normalizeName(head ?? first ?? input);
}

/**
 * Canonical identity of a song: normalized title + primary artist. Two uploads
 * sharing this key are treated as the same song regardless of who posted them.
 */
export function dedupeKeyFor(
  title: string | null | undefined,
  artistName: string | null | undefined,
): string {
  const t = normalizeName(title);
  const a = primaryArtist(artistName);
  if (!t || !a) return "";
  return `${t}|${a}`;
}

const PERSIAN_LETTER = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/u;
const LATIN_LETTER = /[A-Za-z]/;

/** Which writing systems a string actually contains. */
export function scriptsOf(input: string): { latin: boolean; persian: boolean } {
  return { latin: LATIN_LETTER.test(input), persian: PERSIAN_LETTER.test(input) };
}
