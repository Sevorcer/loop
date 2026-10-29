import { describe, expect, it } from "vitest";

import { countBriefingAtRisk } from "../utils/planUtils";

describe("morning briefing at-risk count", () => {
  const nowMs = Date.parse("2026-10-29T20:00:00.000Z");

  it("is zero when today's schedule is empty", () => {
    expect(countBriefingAtRisk([], nowMs)).toBe(0);
  });

  it("counts on-hold jobs that are on today's board", () => {
    expect(
      countBriefingAtRisk(
        [
          { status: "On Hold", scheduledEndAt: null },
          { status: "Scheduled", scheduledEndAt: null },
        ],
        nowMs,
      ),
    ).toBe(1);
  });

  it("counts an open job whose committed end time has passed", () => {
    expect(
      countBriefingAtRisk(
        [
          { status: "In Progress", scheduledEndAt: "2026-10-29T18:00:00.000Z" },
          { status: "Scheduled", scheduledEndAt: "2026-10-29T22:00:00.000Z" },
        ],
        nowMs,
      ),
    ).toBe(1);
  });

  it("does not treat a missing end time as late", () => {
    expect(
      countBriefingAtRisk([{ status: "Scheduled", scheduledEndAt: null }], nowMs),
    ).toBe(0);
  });

  it("ignores completed and cancelled jobs", () => {
    expect(
      countBriefingAtRisk(
        [
          { status: "Completed", scheduledEndAt: "2026-10-29T12:00:00.000Z" },
          { status: "Cancelled", scheduledEndAt: null },
        ],
        nowMs,
      ),
    ).toBe(0);
  });
});
