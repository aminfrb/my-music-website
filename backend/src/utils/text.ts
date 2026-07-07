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
