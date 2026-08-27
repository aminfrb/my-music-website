import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * `publicObjectUrl` reads the configured base at call time via `env`, so each
 * case stubs the env module and re-imports storage with a fresh registry.
 */
async function withBase(base: string) {
  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: {
      s3: {
        publicBaseUrl: base,
        region: "us-east-1",
        bucket: "test-bucket",
        accessKeyId: "key",
        secretAccessKey: "secret",
        forcePathStyle: true,
        endpoint: "https://storage.test",
        getTtl: 3600,
        putTtl: 900,
      },
      uploads: {},
    },
  }));
  return import("../../src/upload/storage");
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.doUnmock("../../src/config/env"));

describe("publicObjectUrl", () => {
  it("serves a key from the public base, unsigned", async () => {
    const { publicObjectUrl } = await withBase("http://s3.l8py.com");
    expect(publicObjectUrl("audio/abc/def")).toBe("http://s3.l8py.com/audio/abc/def");
  });

  it("encodes each path segment but keeps the separators", async () => {
    const { publicObjectUrl } = await withBase("http://s3.l8py.com");
    // Spaces and commas are legal in S3 keys but must not go raw into a URL.
    expect(publicObjectUrl("covers/ChatGPT Image Jul 28, 2026.png")).toBe(
      "http://s3.l8py.com/covers/ChatGPT%20Image%20Jul%2028%2C%202026.png",
    );
  });

  it("does not double up slashes when the base has a trailing one", async () => {
    const { publicObjectUrl } = await withBase("http://s3.l8py.com/");
    // env strips the trailing slash; guard the join anyway.
    expect(publicObjectUrl("audio/x")).not.toContain("//audio");
  });

  it("returns null when no public base is configured, so callers presign", async () => {
    const { publicObjectUrl } = await withBase("");
    expect(publicObjectUrl("audio/abc")).toBeNull();
  });
});
