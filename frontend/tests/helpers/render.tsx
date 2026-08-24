import { type ReactElement, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "@/providers/LocaleProvider";
import { setStoredLocale } from "@/lib/graphql";
import type { Locale } from "@/lib/types";

/** A query client that fails fast and never retries, so tests stay quick. */
export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface Options {
  locale?: Locale;
  queryClient?: QueryClient;
}

/**
 * Render a component inside the providers it expects. Components read copy via
 * `useLocale`, so the locale is part of the fixture rather than something the
 * test asserts around.
 */
export function renderWithProviders(
  ui: ReactElement,
  { locale = "en", queryClient = testQueryClient() }: Options = {},
) {
  setStoredLocale(locale);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>{children}</LocaleProvider>
    </QueryClientProvider>
  );
  return { ...render(ui, { wrapper: Wrapper }), queryClient };
}

