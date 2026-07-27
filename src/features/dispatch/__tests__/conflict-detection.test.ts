import { describe, expect, it } from "vitest";

import type { ScheduleBlock } from "../types/dispatch";
import { detectCrewConflicts, isBlockConflicting } from "../utils/conflictDetection";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeBlock(
  id: string,
  crewName: string,
  scheduledDate: string,
  scheduledStartTime: string,
  scheduledEndTime: string,
): ScheduleBlock {
  return {
    id,
    dispatchPlanId: `plan-${id}`,
    jobId: `job-${id}`,
    crewAssignmentId: `ca-${id}`,
    crewName,
    scheduledDate,
    scheduledStartTime,
    scheduledEndTime,
    estimatedDurationHours: 4,
    jobType: "Install",
    customerName: "Customer",
    propertyName: "Property",
    dispatchStatus: "scheduled",
  };
}

// ─── detectCrewConflicts ─────────────────────────────────────────────────────

describe("detectCrewConflicts", () => {
  it("returns empty set when there are no blocks", () => {
    expect(detectCrewConflicts([])).toEqual(new Set());
  });

  it("returns empty set for a single block", () => {
    const block = makeBlock("b1", "Alpha", "2026-07-25", "07:00", "11:00");
    expect(detectCrewConflicts([block])).toEqual(new Set());
  });

  it("detects overlapping blocks for the same crew on the same day", () => {
    const b1 = makeBlock("b1", "Alpha", "2026-07-25", "07:00", "11:00");
    const b2 = makeBlock("b2", "Alpha", "2026-07-25", "09:00", "14:00");

    const conflicts = detectCrewConflicts([b1, b2]);
    expect(conflicts.has("b1")).toBe(true);
    expect(conflicts.has("b2")).toBe(true);
  });

  it("does not flag blocks from different crews as conflicts", () => {
    const b1 = makeBlock("b1", "Alpha", "2026-07-25", "07:00", "11:00");
    const b2 = makeBlock("b2", "Beta", "2026-07-25", "09:00", "14:00");

    expect(detectCrewConflicts([b1, b2])).toEqual(new Set());
  });

  it("does not flag blocks for the same crew on different days", () => {
    const b1 = makeBlock("b1", "Alpha", "2026-07-25", "07:00", "11:00");
    const b2 = makeBlock("b2", "Alpha", "2026-07-26", "09:00", "14:00");

    expect(detectCrewConflicts([b1, b2])).toEqual(new Set());
  });

  it("does not flag adjacent (touching) blocks as conflicts", () => {
    // b1 ends at 11:00, b2 starts at 11:00 — touching, not overlapping
    const b1 = makeBlock("b1", "Alpha", "2026-07-25", "07:00", "11:00");
    const b2 = makeBlock("b2", "Alpha", "2026-07-25", "11:00", "15:00");

    expect(detectCrewConflicts([b1, b2])).toEqual(new Set());
  });

  it("handles three blocks where only two conflict", () => {
    const b1 = makeBlock("b1", "Alpha", "2026-07-25", "07:00", "10:00");
    const b2 = makeBlock("b2", "Alpha", "2026-07-25", "09:00", "13:00"); // overlaps b1
    const b3 = makeBlock("b3", "Alpha", "2026-07-25", "14:00", "17:00"); // no overlap

    const conflicts = detectCrewConflicts([b1, b2, b3]);
    expect(conflicts.has("b1")).toBe(true);
    expect(conflicts.has("b2")).toBe(true);
    expect(conflicts.has("b3")).toBe(false);
  });

  it("detects conflict when one block is fully contained within another", () => {
    const b1 = makeBlock("b1", "Alpha", "2026-07-25", "07:00", "16:00");
    const b2 = makeBlock("b2", "Alpha", "2026-07-25", "09:00", "12:00");

    const conflicts = detectCrewConflicts([b1, b2]);
    expect(conflicts.has("b1")).toBe(true);
    expect(conflicts.has("b2")).toBe(true);
  });

  it("does not flag non-conflicting blocks for different crews mixed with conflicting ones", () => {
    const b1 = makeBlock("b1", "Alpha", "2026-07-25", "07:00", "11:00");
    const b2 = makeBlock("b2", "Alpha", "2026-07-25", "09:00", "14:00"); // conflicts with b1
    const b3 = makeBlock("b3", "Beta", "2026-07-25", "09:00", "14:00");  // different crew

    const conflicts = detectCrewConflicts([b1, b2, b3]);
    expect(conflicts.has("b1")).toBe(true);
    expect(conflicts.has("b2")).toBe(true);
    expect(conflicts.has("b3")).toBe(false);
  });
});

// ─── isBlockConflicting ───────────────────────────────────────────────────────

describe("isBlockConflicting", () => {
  it("returns true when block ID is in the conflict set", () => {
    expect(isBlockConflicting("b1", new Set(["b1", "b2"]))).toBe(true);
  });

  it("returns false when block ID is not in the conflict set", () => {
    expect(isBlockConflicting("b3", new Set(["b1", "b2"]))).toBe(false);
  });

  it("returns false for an empty conflict set", () => {
    expect(isBlockConflicting("b1", new Set())).toBe(false);
  });
});
