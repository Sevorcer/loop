import { computeFreshness, formatLastSynced, getStaleBannerCopy } from "../utils/freshnessUtils";

// ─── computeFreshness ─────────────────────────────────────────────────────────

describe("computeFreshness", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns fresh when lastSyncedAt is within 5 minutes", () => {
    const lastSync = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 min ago
    const result = computeFreshness(lastSync);
    expect(result.level).toBe("fresh");
    expect(result.minutesAgo).toBe(2);
  });

  it("returns stale when lastSyncedAt is 5–15 minutes ago", () => {
    const lastSync = new Date(Date.now() - 8 * 60 * 1000).toISOString(); // 8 min ago
    const result = computeFreshness(lastSync);
    expect(result.level).toBe("stale");
    expect(result.minutesAgo).toBe(8);
  });

  it("returns elevated_stale when lastSyncedAt is more than 15 minutes ago", () => {
    const lastSync = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 min ago
    const result = computeFreshness(lastSync);
    expect(result.level).toBe("elevated_stale");
    expect(result.minutesAgo).toBe(20);
  });

  it("returns unavailable when lastSyncedAt is null", () => {
    const result = computeFreshness(null);
    expect(result.level).toBe("unavailable");
    expect(result.minutesAgo).toBe(Infinity);
  });

  it("returns exact boundary: exactly 5 minutes ago is stale", () => {
    const lastSync = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = computeFreshness(lastSync);
    expect(result.level).toBe("stale");
  });

  it("returns fresh: just under 5 minutes is fresh", () => {
    const lastSync = new Date(Date.now() - 4 * 60 * 1000 - 59 * 1000).toISOString();
    const result = computeFreshness(lastSync);
    expect(result.level).toBe("fresh");
  });
});

// ─── formatLastSynced ─────────────────────────────────────────────────────────

describe("formatLastSynced", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns 'Just now' for less than 1 minute", () => {
    const lastSync = new Date(Date.now() - 30 * 1000).toISOString();
    expect(formatLastSynced(lastSync)).toBe("Just now");
  });

  it("returns singular '1 minute ago' for exactly 1 minute", () => {
    const lastSync = new Date(Date.now() - 60 * 1000).toISOString();
    expect(formatLastSynced(lastSync)).toBe("1 minute ago");
  });

  it("returns plural 'X minutes ago' for 2+ minutes", () => {
    const lastSync = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    expect(formatLastSynced(lastSync)).toBe("7 minutes ago");
  });

  it("returns 'Unknown' for null", () => {
    expect(formatLastSynced(null)).toBe("Unknown");
  });

  it("returns '1 hour ago' for 60+ minutes", () => {
    const lastSync = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(formatLastSynced(lastSync)).toBe("1 hour ago");
  });

  it("returns plural 'X hours ago' for 2+ hours", () => {
    const lastSync = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatLastSynced(lastSync)).toBe("3 hours ago");
  });
});

// ─── getStaleBannerCopy ───────────────────────────────────────────────────────

describe("getStaleBannerCopy", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("stale: shows banner with Last synchronized copy, no support link", () => {
    const lastSync = new Date(Date.now() - 8 * 60 * 1000).toISOString();
    const freshness = computeFreshness(lastSync);
    const copy = getStaleBannerCopy(freshness);
    expect(copy.heading).toBe("Information may be outdated.");
    expect(copy.body).toContain("Last synchronized");
    expect(copy.showSupportLink).toBe(false);
  });

  it("elevated_stale: shows support link", () => {
    const lastSync = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const freshness = computeFreshness(lastSync);
    const copy = getStaleBannerCopy(freshness);
    expect(copy.showSupportLink).toBe(true);
  });

  it("unavailable: shows support link", () => {
    const freshness = computeFreshness(null);
    const copy = getStaleBannerCopy(freshness);
    expect(copy.showSupportLink).toBe(true);
  });

  it("fresh: returns empty copy (banner should not render)", () => {
    const lastSync = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const freshness = computeFreshness(lastSync);
    const copy = getStaleBannerCopy(freshness);
    expect(copy.heading).toBe("");
    expect(copy.body).toBe("");
  });
});
