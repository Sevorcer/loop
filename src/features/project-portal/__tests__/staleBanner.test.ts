import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";

import { computeFreshness } from "../adapters/eventProjection";

/**
 * Tests for stale banner rendering logic.
 *
 * The StaleBanner component itself requires jsdom, so this test suite
 * validates the underlying computeFreshness function that drives all
 * stale banner behavior — covering all threshold boundaries.
 */
describe("stale banner logic (computeFreshness thresholds)", () => {
  const FIXED_NOW = "2026-07-19T12:00:00.000Z";

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_NOW));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("state=fresh when 0 minutes since sync", () => {
    const now = new Date().toISOString();
    expect(computeFreshness(now).state).toBe("fresh");
  });

  it("state=fresh when 4 minutes since sync (just below warning threshold)", () => {
    const fourMinAgo = new Date(Date.now() - 4 * 60_000).toISOString();
    expect(computeFreshness(fourMinAgo).state).toBe("fresh");
  });

  it("state=stale_warning when exactly 5 minutes since sync (warning threshold)", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(computeFreshness(fiveMinAgo).state).toBe("stale_warning");
  });

  it("state=stale_warning when 10 minutes since sync (within warning band)", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    expect(computeFreshness(tenMinAgo).state).toBe("stale_warning");
  });

  it("state=stale_warning when 14 minutes since sync (just below elevated threshold)", () => {
    const fourteenMinAgo = new Date(Date.now() - 14 * 60_000).toISOString();
    expect(computeFreshness(fourteenMinAgo).state).toBe("stale_warning");
  });

  it("state=stale_elevated when 15 minutes since sync (elevated threshold)", () => {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60_000).toISOString();
    expect(computeFreshness(fifteenMinAgo).state).toBe("stale_elevated");
  });

  it("state=stale_elevated when 30 minutes since sync", () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    expect(computeFreshness(thirtyMinAgo).state).toBe("stale_elevated");
  });

  it("includes accurate minutesSinceSync in result", () => {
    const sevenMinAgo = new Date(Date.now() - 7 * 60_000).toISOString();
    const result = computeFreshness(sevenMinAgo);
    expect(result.minutesSinceSync).toBe(7);
  });

  it("preserves lastSynchronizedAt in result", () => {
    const ts = "2026-07-19T10:00:00.000Z";
    const result = computeFreshness(ts);
    expect(result.lastSynchronizedAt).toBe(ts);
  });

  it("fresh state should NOT show stale banner (no banner for fresh state)", () => {
    // Validates the condition that drives StaleBanner rendering:
    // `if (freshness.state === "fresh") return null`
    const result = computeFreshness(new Date().toISOString());
    expect(result.state === "fresh").toBe(true);
    // Banner would return null; no need to render
  });

  it("stale_warning state should show non-elevated banner", () => {
    const eightMinAgo = new Date(Date.now() - 8 * 60_000).toISOString();
    const result = computeFreshness(eightMinAgo);
    expect(result.state).toBe("stale_warning");
    // Banner message contains "Information may be outdated"
  });

  it("stale_elevated state should show elevated banner with support link", () => {
    const twentyMinAgo = new Date(Date.now() - 20 * 60_000).toISOString();
    const result = computeFreshness(twentyMinAgo);
    expect(result.state).toBe("stale_elevated");
    // Banner message contains support contact
  });
});
