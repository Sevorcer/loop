import { describe, expect, it } from "vitest";

import {
  compareTimelineEventsDesc,
  formatTimelineTimestamp,
  timelineTimestampToEpochMs,
} from "@/lib/timeline";

describe("timeline timestamp utilities", () => {
  it("parses date-only values in UTC for deterministic ordering", () => {
    expect(timelineTimestampToEpochMs("2026-07-18")).toBe(Date.UTC(2026, 6, 18));
  });

  it("sorts newest-first with deterministic id tie-breakers", () => {
    const items = [
      { id: "b-item", occurredAt: "2026-07-18" },
      { id: "a-item", occurredAt: "2026-07-18" },
      { id: "c-item", occurredAt: "2026-07-19" },
    ];

    items.sort(compareTimelineEventsDesc);

    expect(items.map((item) => item.id)).toEqual(["c-item", "a-item", "b-item"]);
  });

  it("formats date-only values without timezone drift", () => {
    expect(formatTimelineTimestamp("2026-07-18")).toBe("Jul 18, 2026");
  });

  it("formats datetime values with explicit UTC timezone", () => {
    expect(formatTimelineTimestamp("2026-07-18T13:45:00.000Z")).toContain("UTC");
  });
});
