import { errors } from "../utils/errors";

interface Bucket {
  count: number;
  resetAt: number;
}

/** How often a map sweeps out expired entries, in milliseconds. */
const SWEEP_INTERVAL_MS = 5 * 60_000;

/**
 * Tiny fixed-window in-memory rate limiter. Good enough for a single-instance
 * dev/MVP deployment; swap for Redis when scaling horizontally.
 *
 * Entries are swept periodically — these maps are keyed by user/IP (and, for
 * the play cooldown, by track as well), so without pruning they would grow for
 * as long as the process lives.
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  /** Consume one unit; returns false instead of throwing when the window is full. */
  tryConsume(key: string): boolean {
    const now = Date.now();
    this.sweep(now);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count >= this.limit) return false;
    bucket.count += 1;
    return true;
  }

  /** Throws a localized RATE_LIMITED error when the caller exceeds the window. */
  consume(key: string): void {
    if (!this.tryConsume(key)) throw errors.rateLimited();
  }
}

/**
 * "At most one event per key per window", where the window is decided per call.
 *
 * Used to stop the same listener counting the same track twice in less time
 * than the track takes to play. Unlike RateLimiter the window isn't fixed at
 * construction, because it depends on the length of the track being played.
 */
export class Cooldown {
  private seen = new Map<string, number>(); // key → expires at
  private lastSweep = Date.now();

  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(key);
    }
  }

  /** True when the key is free (and starts its cooldown); false while cooling. */
  check(key: string, windowMs: number): boolean {
    const now = Date.now();
    this.sweep(now);
    const expiresAt = this.seen.get(key);
    if (expiresAt && expiresAt > now) return false;
    this.seen.set(key, now + windowMs);
    return true;
  }
}

// Shared limiters for sensitive operations.
export const authLimiter = new RateLimiter(10, 60_000); // 10 auth attempts / min / ip
export const uploadLimiter = new RateLimiter(20, 60 * 60_000); // 20 upload sessions / hour / user
/** Presigned PUT URLs create real storage objects, so they get their own cap. */
export const presignLimiter = new RateLimiter(60, 60 * 60_000); // 60 presigns / hour / user
/** Burst guard on playback telemetry — well above any real listening rate. */
export const playLimiter = new RateLimiter(60, 60_000); // 60 play events / min / account
/**
 * Anonymous listeners are keyed by IP, and carrier-grade NAT puts a lot of real
 * people behind one address — common on Iranian mobile networks. This bucket is
 * deliberately loose: the per-track cooldown is what actually stops a single
 * track being inflated, so this only needs to catch runaway scripts.
 */
export const anonPlayLimiter = new RateLimiter(240, 60_000); // 240 / min / ip
/** One counted play per listener per track, for as long as the track lasts. */
export const playCooldown = new Cooldown();
