import { computeRescheduleShift } from "../rescheduleShift";

describe("computeRescheduleShift", () => {
  it("shifts a single-day job forward by one day", () => {
    const result = computeRescheduleShift({
      // Nov 3 at 09:00 PT (17:00 UTC) to 17:00 PT (Nov 4 01:00 UTC)
      scheduledStartAt: "2026-11-03T17:00:00.000Z",
      scheduledEndAt: "2026-11-04T01:00:00.000Z",
      grabDay: "2026-11-03",
      dropDay: "2026-11-04",
    });

    // Should shift both by +1 day, preserving 09:00-17:00 PT
    expect(result.scheduledStartAt).toBe("2026-11-04T17:00:00.000Z");
    expect(result.scheduledEndAt).toBe("2026-11-05T01:00:00.000Z");
  });

  it("shifts a single-day job backward by two days", () => {
    const result = computeRescheduleShift({
      scheduledStartAt: "2026-11-05T17:00:00.000Z",
      scheduledEndAt: "2026-11-06T01:00:00.000Z",
      grabDay: "2026-11-05",
      dropDay: "2026-11-03",
    });

    expect(result.scheduledStartAt).toBe("2026-11-03T17:00:00.000Z");
    expect(result.scheduledEndAt).toBe("2026-11-04T01:00:00.000Z");
  });

  it("preserves the span of a multi-day job", () => {
    const result = computeRescheduleShift({
      // Nov 3 at 08:00 PT (16:00 UTC) to Nov 5 at 16:00 PT (Nov 6 00:00 UTC) = 3-day job
      scheduledStartAt: "2026-11-03T16:00:00.000Z",
      scheduledEndAt: "2026-11-06T00:00:00.000Z",
      grabDay: "2026-11-03",
      dropDay: "2026-11-10",
    });

    // Shifted by +7 days
    expect(result.scheduledStartAt).toBe("2026-11-10T16:00:00.000Z");
    expect(result.scheduledEndAt).toBe("2026-11-13T00:00:00.000Z");
  });

  it("handles crossing a month boundary", () => {
    const result = computeRescheduleShift({
      // Oct 30 at 08:00 PT (15:00 UTC) to Oct 30 at 16:00 PT (23:00 UTC)
      scheduledStartAt: "2026-10-30T15:00:00.000Z",
      scheduledEndAt: "2026-10-30T23:00:00.000Z",
      grabDay: "2026-10-30",
      dropDay: "2026-11-02",
    });

    // Shifted by +3 days across Oct->Nov boundary
    // Note: PDT -> PST transition happens Nov 1. Oct 30 is PDT (UTC-7),
    // Nov 2 is PST (UTC-8). 08:00 PT on Nov 2 = 16:00 UTC.
    expect(result.scheduledStartAt).toBe("2026-11-02T16:00:00.000Z");
    expect(result.scheduledEndAt).toBe("2026-11-03T00:00:00.000Z");
  });

  it("returns original dates when drop is on the same day (no-op)", () => {
    const start = "2026-11-03T17:00:00.000Z";
    const end = "2026-11-04T01:00:00.000Z";

    const result = computeRescheduleShift({
      scheduledStartAt: start,
      scheduledEndAt: end,
      grabDay: "2026-11-03",
      dropDay: "2026-11-03",
    });

    expect(result.scheduledStartAt).toBe(start);
    expect(result.scheduledEndAt).toBe(end);
  });

  it("handles null scheduledEndAt (single-day job without end)", () => {
    const result = computeRescheduleShift({
      scheduledStartAt: "2026-11-03T17:00:00.000Z",
      scheduledEndAt: null,
      grabDay: "2026-11-03",
      dropDay: "2026-11-05",
    });

    // Start shifted by +2 days; end stays null
    expect(result.scheduledStartAt).toBe("2026-11-05T17:00:00.000Z");
    expect(result.scheduledEndAt).toBeNull();
  });
});
