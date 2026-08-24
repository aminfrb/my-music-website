/**
 * Track naming rules.
 *
 * Sniffing the audio bytes stops non-audio files, but it does nothing about the
 * other half of upload junk: real MP3s posted under a machine name. A library
 * full of "8432", "AUD-20240115-WA0007" or "track_01" is unbrowsable, unsearchable
 * and impossible to de-duplicate — so every track must carry a name a human
 * would recognize, written in Latin or Persian script.
 *
 * The rules are deliberately shape-based (script, letter density, known machine
 * patterns) rather than a word list, so they pass any real Persian or English
 * title while rejecting the generated ones.
 */

import { errors } from "../utils/errors";
import { normalizeText, scriptsOf } from "../utils/text";

export const TITLE_MIN = 2;
export const TITLE_MAX = 150;
export const ARTIST_MIN = 2;
export const ARTIST_MAX = 120;

/** Media/file extensions — a name ending in one is a file name, not a title. */
const FILE_EXTENSION =
  /\.(mp3|wav|m4a|m4b|aac|flac|ogg|oga|opus|wma|aiff?|mp4|mkv|avi|mov|tmp|part|bin|dat|zip|rar)\s*$/i;

/** Names produced by phones, recorders and download bots. */
const MACHINE_PATTERNS: RegExp[] = [
  /^aud[-_ ]?\d{4,}/i, // AUD-20240115-WA0007 (WhatsApp)
  /^ptt[-_ ]?\d{4,}/i, // PTT-20240115-WA0001 (voice note)
  /^(img|vid|rec|snd|mp3|trk|file|doc)[-_ ]?\d{2,}/i,
  /^whatsapp\s+(audio|ptt|voice)/i,
  /^(new\s+)?(voice|audio|sound|screen)\s*(memo|recording|record|note)s?\b/i,
  /^(new\s+)?record(ing)?s?\s*\d*$/i,
  /^(track|song|audio|music|sound|file|untitled|unknown|noname|no\s*name)[\s_-]*\d*$/i,
  /^\d{4}[-_]\d{2}[-_]\d{2}/, // 2024-01-15 …
  /^[0-9a-f]{16,}$/i, // hex blobs / hashes
  /^copy\s+of\b/i,
  /^final\s*\d*$/i,
  /^(new\s+)?(mix|demo|test|sample|temp)\s*\d*$/i,
  // Persian equivalents
  /^(بدون\s*نام|بی\s*نام|ناشناس|نامشخص|تست|نمونه|ضبط|صدای?\s*ضبط\s*شده)\s*\d*$/,
  /^(آهنگ|موزیک|ترک|فایل|صدا)\s*\d*$/,
];

/** Channel/site promotion that people paste into ID3 tags. */
const PROMO_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /www\.[a-z0-9-]+\.[a-z]{2,}/i,
  /\b[a-z0-9-]+\.(com|ir|net|org|me|info|xyz|top|site|co)\b/i,
  /(^|\s)@[\w.]{3,}/,
  /\bt\.me\b|\btelegram\b|\bتلگرام\b|\bکانال\b/i,
];

/** Long consonant runs and repeated characters — keyboard mashing. */
const REPEATED_CHAR = /(.)\1{4,}/u;
const LATIN_VOWEL = /[aeiouy]/i;

function collapse(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export interface NameCheck {
  ok: boolean;
  /** i18n key describing why the name was rejected. */
  reason?: string;
}

/**
 * Shared shape rules for any human-facing name (title or artist).
 * `field` only selects the length bounds.
 */
function checkName(raw: string, min: number, max: number): NameCheck {
  const value = collapse(raw ?? "");

  if (value.length < min) return { ok: false, reason: "errors.nameTooShort" };
  if (value.length > max) return { ok: false, reason: "errors.nameTooLong" };

  // Ordered most-specific first, so the user is told exactly what's wrong
  // rather than getting the broadest rule that happens to also match.
  if (FILE_EXTENSION.test(value)) return { ok: false, reason: "errors.nameLooksLikeFile" };

  for (const p of PROMO_PATTERNS) {
    if (p.test(value)) return { ok: false, reason: "errors.namePromotional" };
  }

  const normalized = normalizeText(value);
  for (const p of MACHINE_PATTERNS) {
    if (p.test(normalized)) return { ok: false, reason: "errors.nameMachineGenerated" };
  }

  if (REPEATED_CHAR.test(value)) return { ok: false, reason: "errors.nameGibberish" };

  // Strip everything that isn't a letter to measure how much of the name is
  // actually a name (rejects "8432", "128 320", "01 - 02").
  const letters = value.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return { ok: false, reason: "errors.nameNeedsLetters" };
  const digits = value.replace(/[^\p{N}]/gu, "");
  if (digits.length > letters.length) return { ok: false, reason: "errors.nameNeedsLetters" };

  // It has real words — but are they in a script we can display and search?
  const { latin, persian } = scriptsOf(value);
  if (!latin && !persian) return { ok: false, reason: "errors.nameScript" };

  // Latin-only names of any length need a vowel somewhere — "kjhdfg" doesn't.
  if (latin && !persian && letters.length >= 4 && !LATIN_VOWEL.test(letters)) {
    return { ok: false, reason: "errors.nameGibberish" };
  }

  return { ok: true };
}

export function checkTitle(raw: string): NameCheck {
  return checkName(raw, TITLE_MIN, TITLE_MAX);
}

export function checkArtistName(raw: string): NameCheck {
  // Checked before the shared rules so "unknown" gets the artist-specific
  // message instead of the generic machine-name one.
  const normalized = normalizeText(collapse(raw ?? ""));
  if (/^(unknown|various(\s*artists?)?|va|artist|singer|me|myself|admin|user)\s*\d*$/.test(normalized)) {
    return { ok: false, reason: "errors.artistNamePlaceholder" };
  }
  return checkName(raw, ARTIST_MIN, ARTIST_MAX);
}

/** Throwing wrappers used by the upload flow. */
export function assertValidTitle(raw: string): void {
  const res = checkTitle(raw);
  if (!res.ok) throw errors.badInput(res.reason!, { field: "title" });
}

export function assertValidArtistName(raw: string): void {
  const res = checkArtistName(raw);
  if (!res.ok) throw errors.badInput(res.reason!, { field: "artistName" });
}
