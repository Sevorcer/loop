/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Keyed by an arbitrary string (IP address, token, etc.).
 * State is lost on process restart — acceptable for v1.
 *
 * Not suitable for multi-instance deployments without a shared store.
 */

import { NextResponse } from "next/server";

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface WindowEntry {
  timestamps: number[];
}

/**
 * Creates a rate limiter instance with its own state map.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const store = new Map<string, WindowEntry>();

  // Periodically prune stale entries to prevent unbounded memory growth.
  const PRUNE_INTERVAL_MS = Math.max(config.windowMs * 2, 60_000);
  let lastPrune = Date.now();

  function prune(now: number) {
    if (now - lastPrune < PRUNE_INTERVAL_MS) return;
    lastPrune = now;
    const cutoff = now - config.windowMs;
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }

  /**
   * Check whether `key` has exceeded the rate limit.
   *
   * Returns `null` if allowed, or a 429 `NextResponse` if rate-limited.
   */
  function check(key: string): NextResponse | null {
    const now = Date.now();
    prune(now);

    const cutoff = now - config.windowMs;
    let entry = store.get(key);

    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // Remove timestamps outside the current window.
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= config.maxRequests) {
      const retryAfterSeconds = Math.ceil(
        (entry.timestamps[0] + config.windowMs - now) / 1000,
      );
      return NextResponse.json(
        {
          error: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Please try again later.",
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        },
      );
    }

    entry.timestamps.push(now);
    return null;
  }

  /** Reset all state (useful for testing). */
  function reset() {
    store.clear();
  }

  return { check, reset };
}
