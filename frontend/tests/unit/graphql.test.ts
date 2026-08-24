import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  gql,
  GraphQLError,
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  getStoredLocale,
  setStoredLocale,
  putToPresignedUrl,
} from "@/lib/graphql";

/** Queue of responses the mocked fetch will hand back, in order. */
function mockFetch(...responses: unknown[]) {
  const fn = vi.fn();
  for (const body of responses) {
    fn.mockResolvedValueOnce({ ok: true, json: async () => body });
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Run an operation expected to fail, and hand back the error it threw. */
async function failing(query: string, variables?: Record<string, unknown>): Promise<GraphQLError> {
  try {
    await gql(query, variables);
  } catch (err) {
    return err as GraphQLError;
  }
  throw new Error("expected the operation to fail, but it resolved");
}

const bodyOf = (call: unknown[]) =>
  JSON.parse((call[1] as { body: string }).body) as { query: string; variables: unknown };
const headersOf = (call: unknown[]) =>
  (call[1] as { headers: Record<string, string> }).headers;

beforeEach(() => {
  clearTokens();
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("token storage", () => {
  it("round-trips the token pair", () => {
    setTokens("access-1", "refresh-1");
    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("clears both tokens on sign-out", () => {
    setTokens("a", "r");
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("defaults the locale to en and round-trips fa", () => {
    expect(getStoredLocale()).toBe("en");
    setStoredLocale("fa");
    expect(getStoredLocale()).toBe("fa");
  });

  it("falls back to en for an unrecognized stored locale", () => {
    window.localStorage.setItem("spidermelody.locale", "de");
    expect(getStoredLocale()).toBe("en");
  });
});

describe("gql — requests", () => {
  it("posts the query and variables as JSON", async () => {
    const fetchMock = mockFetch({ data: { ok: true } });
    await gql("query Foo { ok }", { a: 1 });

    const sent = bodyOf(fetchMock.mock.calls[0]);
    expect(sent.query).toBe("query Foo { ok }");
    expect(sent.variables).toEqual({ a: 1 });
    expect(headersOf(fetchMock.mock.calls[0])["content-type"]).toBe("application/json");
  });

  it("sends the stored locale so the server can localize errors", async () => {
    setStoredLocale("fa");
    const fetchMock = mockFetch({ data: {} });
    await gql("query {}");
    expect(headersOf(fetchMock.mock.calls[0])["x-locale"]).toBe("fa");
  });

  it("attaches the bearer token when signed in", async () => {
    setTokens("access-1", "refresh-1");
    const fetchMock = mockFetch({ data: {} });
    await gql("query {}");
    expect(headersOf(fetchMock.mock.calls[0]).authorization).toBe("Bearer access-1");
  });

  it("omits the authorization header when signed out", async () => {
    const fetchMock = mockFetch({ data: {} });
    await gql("query {}");
    expect(headersOf(fetchMock.mock.calls[0]).authorization).toBeUndefined();
  });

  it("returns the data payload", async () => {
    mockFetch({ data: { me: { id: "u1" } } });
    await expect(gql("query {}")).resolves.toEqual({ me: { id: "u1" } });
  });
});

describe("gql — errors", () => {
  it("throws a GraphQLError carrying the message and code", async () => {
    mockFetch({
      errors: [{ message: "Track not found.", extensions: { code: "NOT_FOUND" } }],
    });
    const err = await failing("query {}");
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toBe("Track not found.");
    expect(err.code).toBe("NOT_FOUND");
  });

  it("surfaces the structured details a duplicate upload carries", async () => {
    // This payload is what lets the upload screen show who posted the track
    // first, instead of a bare error string.
    const duplicate = {
      kind: "song",
      musicId: "m1",
      title: "Seyl",
      artistName: "Mehrad Hidden",
      uploader: { id: "u9", displayName: "Ali", avatarUrl: null, isVerifiedArtist: false },
    };
    mockFetch({
      errors: [
        {
          message: '"Seyl" by Mehrad Hidden has already been uploaded by Ali.',
          extensions: { code: "CONFLICT", details: { duplicate } },
        },
      ],
    });
    const err = await failing("mutation {}");
    expect(err.code).toBe("CONFLICT");
    expect(err.details).toEqual({ duplicate });
  });

  it("leaves details undefined when the error carries none", async () => {
    mockFetch({ errors: [{ message: "nope", extensions: { code: "BAD_USER_INPUT" } }] });
    const err = await failing("query {}");
    expect(err.details).toBeUndefined();
  });

  it("throws when the response has neither data nor errors", async () => {
    mockFetch({});
    await expect(gql("query {}")).rejects.toThrow(GraphQLError);
  });

  it("reports only the first error when several come back", async () => {
    mockFetch({
      errors: [
        { message: "first", extensions: { code: "A" } },
        { message: "second", extensions: { code: "B" } },
      ],
    });
    const err = await failing("query {}");
    expect(err.message).toBe("first");
  });
});

describe("gql — access-token refresh", () => {
  const unauthenticated = {
    errors: [{ message: "expired", extensions: { code: "UNAUTHENTICATED" } }],
  };

  it("refreshes once and replays the original request", async () => {
    setTokens("stale", "refresh-1");
    const fetchMock = mockFetch(
      unauthenticated,
      { data: { refreshToken: { accessToken: "fresh", refreshToken: "refresh-2" } } },
      { data: { me: { id: "u1" } } },
    );

    await expect(gql("query Me { me { id } }")).resolves.toEqual({ me: { id: "u1" } });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // The replay carries the new token, and the new pair is persisted.
    expect(headersOf(fetchMock.mock.calls[2]).authorization).toBe("Bearer fresh");
    expect(getAccessToken()).toBe("fresh");
    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("gives up and clears tokens when the refresh itself fails", async () => {
    setTokens("stale", "bad-refresh");
    mockFetch(unauthenticated, {
      errors: [{ message: "invalid", extensions: { code: "UNAUTHENTICATED" } }],
    });

    await expect(gql("query {}")).rejects.toThrow();
    // A dead session must not linger in storage.
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("does not attempt a refresh without a refresh token", async () => {
    const fetchMock = mockFetch(unauthenticated);
    await expect(gql("query {}")).rejects.toThrow("expired");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries only once, so an always-401 server can't loop", async () => {
    setTokens("stale", "refresh-1");
    const fetchMock = mockFetch(
      unauthenticated,
      { data: { refreshToken: { accessToken: "fresh", refreshToken: "refresh-2" } } },
      unauthenticated,
    );
    await expect(gql("query {}")).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shares one refresh between concurrent requests", async () => {
    setTokens("stale", "refresh-1");
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const { query } = JSON.parse(init.body) as { query: string };
      if (query.includes("Refresh")) {
        return {
          ok: true,
          json: async () => ({
            data: { refreshToken: { accessToken: "fresh", refreshToken: "refresh-2" } },
          }),
        };
      }
      const stale = getAccessToken() === "stale";
      return {
        ok: true,
        json: async () => (stale ? unauthenticated : { data: { ok: true } }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([gql("query A { ok }"), gql("query B { ok }"), gql("query C { ok }")]);

    // Three originals + three replays + exactly one shared refresh.
    const refreshCalls = fetchMock.mock.calls.filter((c) =>
      (JSON.parse((c[1] as { body: string }).body) as { query: string }).query.includes("Refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });
});

describe("putToPresignedUrl", () => {
  it("PUTs the file with its own content type", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["abc"], "song.mp3", { type: "audio/mpeg" });

    await putToPresignedUrl("https://storage.test/put", file);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://storage.test/put");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("audio/mpeg");
  });

  it("throws when storage rejects the upload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403 })));
    const file = new File(["abc"], "song.mp3", { type: "audio/mpeg" });
    await expect(putToPresignedUrl("https://storage.test/put", file)).rejects.toThrow("403");
  });
});
