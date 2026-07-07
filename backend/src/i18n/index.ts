import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "../config/env";
import en from "./locales/en.json";
import fa from "./locales/fa.json";
import { logger } from "../utils/logger";

export type Locale = "en" | "fa";
export type TranslationKey = keyof typeof en;
export type TranslationParams = Record<string, string | number>;

const catalogs: Record<Locale, Record<string, string>> = { en, fa };

// Request-scoped locale. An Express middleware wraps each request in
// `runWithLocale`, so any code (including deep service code and Apollo's
// formatError) can recover the active locale without threading it everywhere.
const localeStore = new AsyncLocalStorage<{ locale: Locale }>();

export function isSupportedLocale(value: string | undefined | null): value is Locale {
  return !!value && env.i18n.supportedLocales.includes(value);
}

/** Pick a locale from an explicit value or an Accept-Language header. */
export function resolveLocale(
  explicit?: string | null,
  acceptLanguage?: string | null,
): Locale {
  if (isSupportedLocale(explicit)) return explicit;
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(",")) {
      const tag = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
      if (isSupportedLocale(tag)) return tag;
    }
  }
  return (env.i18n.defaultLocale as Locale) ?? "en";
}

export function runWithLocale<T>(locale: Locale, fn: () => T): T {
  return localeStore.run({ locale }, fn);
}

export function getLocale(): Locale {
  return localeStore.getStore()?.locale ?? ((env.i18n.defaultLocale as Locale) || "en");
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}

/**
 * Translate a key. Falls back: requested locale → English → the raw key.
 * Locale defaults to the request-scoped locale when omitted.
 */
export function t(
  key: TranslationKey | string,
  params?: TranslationParams,
  locale: Locale = getLocale(),
): string {
  const fromLocale = catalogs[locale]?.[key];
  if (fromLocale) return interpolate(fromLocale, params);
  const fromEn = catalogs.en[key];
  if (fromEn) return interpolate(fromEn, params);
  logger.warn("missing translation key", { key, locale });
  return key;
}
