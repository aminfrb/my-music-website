"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dictionaries, type Dict } from "@/i18n/dictionaries";
import { getStoredLocale, setStoredLocale } from "@/lib/graphql";
import type { Locale } from "@/lib/types";

/** Values substituted into a `{placeholder}` in a dictionary entry. */
export type TranslationParams = Record<string, string | number>;

interface LocaleContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: keyof Dict, params?: TranslationParams) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const queryClient = useQueryClient();

  // Hydrate from storage after mount (avoids SSR mismatch).
  useEffect(() => {
    setLocaleState(getStoredLocale());
  }, []);

  // Keep <html lang/dir> in sync so CSS + fonts + layout flip correctly.
  useEffect(() => {
    const dir = locale === "fa" ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", locale);
    document.documentElement.setAttribute("dir", dir);
  }, [locale]);

  /**
   * Not everything on screen comes from the dictionary. Genre names — and the
   * API's error messages — are localized on the server, which reads the
   * `x-locale` header this client sends. React Query caches those responses
   * under keys that say nothing about language, so switching locale used to
   * flip the headings while the genre chips stayed in the old one. Dropping
   * the cache lets every server-localized field catch up.
   */
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    void queryClient.invalidateQueries();
  }, [locale, queryClient]);

  const setLocale = useCallback((next: Locale) => {
    setStoredLocale(next);
    setLocaleState(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "en" ? "fa" : "en");
  }, [locale, setLocale]);

  /**
   * Look up a phrase, substituting any `{placeholder}` values.
   *
   * Interpolating rather than concatenating matters for a bilingual UI: word
   * order isn't the same in both languages, so "Play {title}" has to be one
   * translatable string per locale, not a verb glued to a noun in code.
   * An unmatched placeholder is left visible so a missing value is obvious.
   */
  const t = useCallback(
    (key: keyof Dict, params?: TranslationParams) => {
      const template = dictionaries[locale][key] ?? String(key);
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match,
      );
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: locale === "fa" ? "rtl" : "ltr",
      setLocale,
      toggleLocale,
      t,
    }),
    [locale, setLocale, toggleLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
