// Minimal, typed GraphQL-over-fetch client with JWT storage, locale header,
// and one-shot access-token refresh on expiry.

import type { Locale } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/graphql";

const ACCESS_KEY = "harmony.accessToken";
const REFRESH_KEY = "harmony.refreshToken";
const LOCALE_KEY = "harmony.locale";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}
export function setTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}
export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}
export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(LOCALE_KEY);
  return v === "fa" ? "fa" : "en";
}
export function setStoredLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_KEY, locale);
}

export class GraphQLError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "GraphQLError";
    this.code = code;
  }
}

interface GqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

async function rawRequest<T>(
  query: string,
  variables: Record<string, unknown> | undefined,
  token: string | null,
): Promise<GqlResponse<T>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-locale": getStoredLocale(),
  };
  if (token) headers["authorization"] = `Bearer ${token}`;

  const res = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as GqlResponse<T>;
}

// Deduplicate concurrent refreshes.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshInFlight = (async () => {
    try {
      const json = await rawRequest<{
        refreshToken: { accessToken: string; refreshToken: string };
      }>(
        `mutation Refresh($t: String!) {
           refreshToken(refreshToken: $t) { accessToken refreshToken }
         }`,
        { t: refreshToken },
        null,
      );
      const payload = json.data?.refreshToken;
      if (payload) {
        setTokens(payload.accessToken, payload.refreshToken);
        return true;
      }
      clearTokens();
      return false;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function isAuthError(errors?: GqlResponse<unknown>["errors"]): boolean {
  return Boolean(errors?.some((e) => e.extensions?.code === "UNAUTHENTICATED"));
}

/** Run a GraphQL operation. Throws GraphQLError on failure. */
export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let json = await rawRequest<T>(query, variables, getAccessToken());

  if (isAuthError(json.errors) && (await tryRefresh())) {
    json = await rawRequest<T>(query, variables, getAccessToken());
  }

  if (json.errors && json.errors.length) {
    const first = json.errors[0];
    throw new GraphQLError(first.message, first.extensions?.code);
  }
  if (!json.data) throw new GraphQLError("Empty response from server");
  return json.data;
}

/** Upload a file with a presigned PUT URL (direct-to-storage). */
export async function putToPresignedUrl(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
}
