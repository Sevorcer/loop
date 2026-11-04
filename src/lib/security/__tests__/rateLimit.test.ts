import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "../rateLimit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    expect(limiter.check("ip-1")).toBeNull();
    expect(limiter.check("ip-1")).toBeNull();
    expect(limiter.check("ip-1")).toBeNull();
  });

  it("returns 429 when the limit is exceeded", async () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    expect(limiter.check("ip-1")).toBeNull();
    expect(limiter.check("ip-1")).toBeNull();
    const blocked = limiter.check("ip-1");
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    const body = await blocked!.json();
    expect(body.error).toBe("TOO_MANY_REQUESTS");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window expires", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 10_000 });
    expect(limiter.check("ip-1")).toBeNull();
    expect(limiter.check("ip-1")).not.toBeNull();
    vi.advanceTimersByTime(11_000);
    expect(limiter.check("ip-1")).toBeNull();
  });

  it("tracks different keys independently", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    expect(limiter.check("ip-1")).toBeNull();
    expect(limiter.check("ip-2")).toBeNull();
    expect(limiter.check("ip-1")).not.toBeNull();
    expect(limiter.check("ip-2")).not.toBeNull();
  });

  it("reset() clears all state", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    expect(limiter.check("ip-1")).toBeNull();
    expect(limiter.check("ip-1")).not.toBeNull();
    limiter.reset();
    expect(limiter.check("ip-1")).toBeNull();
  });
});
