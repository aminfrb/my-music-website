import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter, Cooldown } from "../../src/middleware/rateLimit";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("RateLimiter", () => {
  it("allows exactly `limit` calls per window", () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.tryConsume("a")).toBe(true);
    expect(limiter.tryConsume("a")).toBe(true);
    expect(limiter.tryConsume("a")).toBe(true);
    expect(limiter.tryConsume("a")).toBe(false);
  });

  it("keys are independent", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.tryConsume("a")).toBe(true);
    expect(limiter.tryConsume("a")).toBe(false);
    expect(limiter.tryConsume("b")).toBe(true);
  });

  it("refills once the window rolls over", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.tryConsume("a")).toBe(true);
    expect(limiter.tryConsume("a")).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(limiter.tryConsume("a")).toBe(true);
  });

  it("consume() throws a RATE_LIMITED error instead of returning false", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.consume("a");
    try {
      limiter.consume("a");
      throw new Error("expected consume to throw");
    } catch (err) {
      expect((err as { extensions?: { code?: string } }).extensions?.code).toBe("RATE_LIMITED");
    }
  });

  it("prunes expired buckets so the map doesn't grow forever", () => {
    const limiter = new RateLimiter(1, 1_000);
    for (let i = 0; i < 500; i++) limiter.tryConsume(`key-${i}`);
    const size = () => (limiter as unknown as { buckets: Map<string, unknown> }).buckets.size;
    expect(size()).toBe(500);

    // Sweeping is lazy — it happens on the next call after the interval.
    vi.advanceTimersByTime(6 * 60_000);
    limiter.tryConsume("trigger");
    expect(size()).toBe(1);
  });
});

describe("Cooldown", () => {
  it("blocks a repeat within the window and allows it after", () => {
    const cooldown = new Cooldown();
    expect(cooldown.check("user|track", 10_000)).toBe(true);
    expect(cooldown.check("user|track", 10_000)).toBe(false);
    vi.advanceTimersByTime(10_001);
    expect(cooldown.check("user|track", 10_000)).toBe(true);
  });

  it("takes the window per call, since it depends on track length", () => {
    const cooldown = new Cooldown();
    cooldown.check("short", 1_000);
    cooldown.check("long", 100_000);
    vi.advanceTimersByTime(1_001);
    expect(cooldown.check("short", 1_000)).toBe(true);
    expect(cooldown.check("long", 100_000)).toBe(false);
  });

  it("keys are independent", () => {
    const cooldown = new Cooldown();
    expect(cooldown.check("a|1", 10_000)).toBe(true);
    expect(cooldown.check("a|2", 10_000)).toBe(true);
    expect(cooldown.check("b|1", 10_000)).toBe(true);
    expect(cooldown.check("a|1", 10_000)).toBe(false);
  });

  it("prunes expired entries", () => {
    const cooldown = new Cooldown();
    for (let i = 0; i < 500; i++) cooldown.check(`k${i}`, 1_000);
    const size = () => (cooldown as unknown as { seen: Map<string, number> }).seen.size;
    expect(size()).toBe(500);
    vi.advanceTimersByTime(6 * 60_000);
    cooldown.check("trigger", 1_000);
    expect(size()).toBe(1);
  });
});
