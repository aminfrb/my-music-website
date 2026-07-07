import { errors } from "../utils/errors";

interface Bucket {
  count: number;
  resetAt: number;
}
/**
 * Tiny fixed-window in-memory rate limiter. Good enough for a single-instance
 * dev/MVP deployment; swap for Redis when scaling horizontally.
 */

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Throws a localized RATE_LIMITED error when the caller exceeds the window. */
  consume(key: string): void {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    if (bucket.count >= this.limit) {
      throw errors.rateLimited();
    }
    bucket.count += 1;
  }
}

// Shared limiters for sensitive operations.
export const authLimiter = new RateLimiter(10, 60_000); // 10 auth attempts / min / ip
export const uploadLimiter = new RateLimiter(20, 60 * 60_000); // 20 uploads / hour / user
