import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

import type {
  CrewAssignment,
  DispatchEvent,
  DispatchPlan,
  DispatchStatus,
  Dispatchability,
  ScheduleBlock,
  Crew,
} from "../types/dispatch";
import {
  assembleDispatchSnapshot,
  deriveIsDispatchable,
  formatScheduleTime,
  formatTargetDate,
  getCrewAssignmentForPlan,
  getDispatchBoardGroup,
  getDispatchEventLabel,
  getDispatchStatusLabel,
  getEventsForPlan,
  getLocalTodayISO,
  getScheduleBlocksForCrew,
  getScheduleBlocksForDate,
} from "../utils/dispatchUtils";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeReadiness(satisfied = true): Dispatchability["materialReadiness"] {
  return {
    state: satisfied ? "satisfied" : "not_satisfied",
    reason: satisfied ? "" : "Missing item",
  };
}

function makeFullDispatchability(allSatisfied: boolean): Dispatchability {
  return {
    isDispatchable: allSatisfied,
    materialReadiness: makeReadiness(allSatisfied),
    technicalReadiness: makeReadiness(allSatisfied),
    customerReadiness: makeReadiness(allSatisfied),
    crewReadiness: makeReadiness(allSatisfied),
  };
}

function makePlan(
  id: string,
  status: DispatchStatus = "ready_to_schedule",
): DispatchPlan {
  return {
    id,
    jobId: id,
    jobNumber: `JOB-${id}`,
    customerName: "Customer",
    propertyName: "Property",
    jobType: "Install",
    dispatchStatus: status,
    dispatchability: makeFullDispatchability(status === "ready_to_schedule"),
    targetDate: "2026-07-25",
    estimatedDurationHours: 4,
    priority: "normal",
    constraints: [],
    createdAt: "2026-07-20T09:00:00.000Z",
    updatedAt: "2026-07-20T09:00:00.000Z",
  };
}

// ─── deriveIsDispatchable ─────────────────────────────────────────────────────

describe("deriveIsDispatchable", () => {
  it("returns true when all four readiness inputs are satisfied", () => {
    const d = makeFullDispatchability(true);
    expect(deriveIsDispatchable(d)).toBe(true);
  });

  it("returns false when material readiness is not satisfied", () => {
    const d: Dispatchability = {
      ...makeFullDispatchability(true),
      materialReadiness: makeReadiness(false),
    };
    expect(deriveIsDispatchable(d)).toBe(false);
  });

  it("returns false when technical readiness is not satisfied", () => {
    const d: Dispatchability = {
      ...makeFullDispatchability(true),
      technicalReadiness: makeReadiness(false),
    };
    expect(deriveIsDispatchable(d)).toBe(false);
  });

  it("returns false when customer readiness is not satisfied", () => {
    const d: Dispatchability = {
      ...makeFullDispatchability(true),
      customerReadiness: makeReadiness(false),
    };
    expect(deriveIsDispatchable(d)).toBe(false);
  });

  it("returns false when crew readiness is not satisfied", () => {
    const d: Dispatchability = {
      ...makeFullDispatchability(true),
      crewReadiness: makeReadiness(false),
    };
    expect(deriveIsDispatchable(d)).toBe(false);
  });

  it("returns false when no readiness inputs are satisfied", () => {
    expect(deriveIsDispatchable(makeFullDispatchability(false))).toBe(false);
  });
});

// ─── getDispatchBoardGroup ────────────────────────────────────────────────────

describe("getDispatchBoardGroup", () => {
  it("ready_to_schedule → ready", () => {
    expect(getDispatchBoardGroup("ready_to_schedule")).toBe("ready");
  });

  it("scheduled → scheduled", () => {
    expect(getDispatchBoardGroup("scheduled")).toBe("scheduled");
  });

  it("in_progress → active", () => {
    expect(getDispatchBoardGroup("in_progress")).toBe("active");
  });

  it("awaiting_materials → blocked", () => {
    expect(getDispatchBoardGroup("awaiting_materials")).toBe("blocked");
  });

  it("awaiting_technical_readiness → blocked", () => {
    expect(getDispatchBoardGroup("awaiting_technical_readiness")).toBe("blocked");
  });

  it("awaiting_customer_confirmation → blocked", () => {
    expect(getDispatchBoardGroup("awaiting_customer_confirmation")).toBe("blocked");
  });

  it("awaiting_crew_availability → blocked", () => {
    expect(getDispatchBoardGroup("awaiting_crew_availability")).toBe("blocked");
  });

  it("completed → other (removed from board)", () => {
    expect(getDispatchBoardGroup("completed")).toBe("other");
  });
});

// ─── getDispatchStatusLabel ───────────────────────────────────────────────────

describe("getDispatchStatusLabel", () => {
  it("ready_to_schedule produces a human-readable label", () => {
    expect(getDispatchStatusLabel("ready_to_schedule")).toBe("Ready to Schedule");
  });

  it("in_progress produces In Progress", () => {
    expect(getDispatchStatusLabel("in_progress")).toBe("In Progress");
  });

  it("awaiting_customer_confirmation is labelled correctly", () => {
    expect(getDispatchStatusLabel("awaiting_customer_confirmation")).toBe(
      "Awaiting Customer Confirmation",
    );
  });

  it("completed produces Completed", () => {
    expect(getDispatchStatusLabel("completed")).toBe("Completed");
  });
});

// ─── getDispatchEventLabel ────────────────────────────────────────────────────

describe("getDispatchEventLabel", () => {
  it("job_scheduled produces a label", () => {
    expect(getDispatchEventLabel("job_scheduled")).toBe("Job Scheduled");
  });

  it("crew_dispatched produces a label", () => {
    expect(getDispatchEventLabel("crew_dispatched")).toBe("Crew Dispatched");
  });

  it("dispatch_plan_created produces a label", () => {
    expect(getDispatchEventLabel("dispatch_plan_created")).toBe("Plan Created");
  });
});

// ─── assembleDispatchSnapshot metrics ────────────────────────────────────────

describe("assembleDispatchSnapshot — metrics derivation", () => {
  it("counts plans by dispatch status correctly", () => {
    const plans: DispatchPlan[] = [
      makePlan("1", "ready_to_schedule"),
      makePlan("2", "ready_to_schedule"),
      makePlan("3", "scheduled"),
      makePlan("4", "in_progress"),
      makePlan("5", "awaiting_materials"),
      makePlan("6", "awaiting_technical_readiness"),
      makePlan("7", "awaiting_customer_confirmation"),
      makePlan("8", "awaiting_crew_availability"),
    ];

    const snapshot = assembleDispatchSnapshot(plans, [], [], [], []);

    expect(snapshot.metrics.readyToSchedule).toBe(2);
    expect(snapshot.metrics.scheduled).toBe(1);
    expect(snapshot.metrics.inProgress).toBe(1);
    expect(snapshot.metrics.awaitingMaterials).toBe(1);
    expect(snapshot.metrics.awaitingTechnicalReadiness).toBe(1);
    expect(snapshot.metrics.awaitingCustomer).toBe(1);
    expect(snapshot.metrics.awaitingCrew).toBe(1);
    expect(snapshot.metrics.totalPlans).toBe(8);
  });

  it("returns zero counts for all metrics when no plans are provided", () => {
    const snapshot = assembleDispatchSnapshot([], [], [], [], []);
    expect(snapshot.metrics.totalPlans).toBe(0);
    expect(snapshot.metrics.readyToSchedule).toBe(0);
    expect(snapshot.metrics.inProgress).toBe(0);
  });

  it("passes through crewAssignments, scheduleBlocks, events, and crews unchanged", () => {
    const crews: Crew[] = [
      { id: "crew-001", name: "Alpha Team", members: [], active: true },
    ];
    const snapshot = assembleDispatchSnapshot([], [], [], [], crews);
    expect(snapshot.crews).toEqual(crews);
  });
});

// ─── Schedule block helpers ───────────────────────────────────────────────────

describe("getScheduleBlocksForCrew", () => {
  const blocks: ScheduleBlock[] = [
    { id: "b1", crewName: "Alpha", dispatchPlanId: "p1", scheduledDate: "2026-07-25", startTime: "08:00", endTime: "12:00", durationHours: 4 },
    { id: "b2", crewName: "Beta", dispatchPlanId: "p2", scheduledDate: "2026-07-25", startTime: "09:00", endTime: "13:00", durationHours: 4 },
    { id: "b3", crewName: "Alpha", dispatchPlanId: "p3", scheduledDate: "2026-07-26", startTime: "07:00", endTime: "11:00", durationHours: 4 },
  ];

  it("returns only blocks for the requested crew", () => {
    const result = getScheduleBlocksForCrew(blocks, "Alpha");
    expect(result).toHaveLength(2);
    expect(result.every((b) => b.crewName === "Alpha")).toBe(true);
  });

  it("returns empty array for an unknown crew", () => {
    expect(getScheduleBlocksForCrew(blocks, "Gamma")).toHaveLength(0);
  });
});

describe("getScheduleBlocksForDate", () => {
  const blocks: ScheduleBlock[] = [
    { id: "b1", crewName: "Alpha", dispatchPlanId: "p1", scheduledDate: "2026-07-25", startTime: "08:00", endTime: "12:00", durationHours: 4 },
    { id: "b2", crewName: "Beta", dispatchPlanId: "p2", scheduledDate: "2026-07-26", startTime: "09:00", endTime: "13:00", durationHours: 4 },
  ];

  it("returns blocks for the given date only", () => {
    const result = getScheduleBlocksForDate(blocks, "2026-07-25");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b1");
  });

  it("returns empty array when no blocks match the date", () => {
    expect(getScheduleBlocksForDate(blocks, "2026-08-01")).toHaveLength(0);
  });
});

describe("getCrewAssignmentForPlan", () => {
  const assignments: CrewAssignment[] = [
    { id: "ca-001", dispatchPlanId: "plan-001", crewId: "crew-001", crewName: "Alpha Team", assignedDate: "2026-07-25" },
    { id: "ca-002", dispatchPlanId: "plan-002", crewId: "crew-002", crewName: "Beta Team", assignedDate: "2026-07-26" },
  ];

  it("returns the assignment for a known plan", () => {
    const result = getCrewAssignmentForPlan(assignments, "plan-001");
    expect(result?.crewName).toBe("Alpha Team");
  });

  it("returns undefined for an unknown plan", () => {
    expect(getCrewAssignmentForPlan(assignments, "plan-999")).toBeUndefined();
  });
});

describe("getEventsForPlan", () => {
  const events: DispatchEvent[] = [
    { id: "e1", dispatchPlanId: "plan-001", type: "job_scheduled", timestamp: "2026-07-20T10:00:00.000Z", description: "Scheduled" },
    { id: "e2", dispatchPlanId: "plan-001", type: "crew_assigned", timestamp: "2026-07-21T10:00:00.000Z", description: "Crew assigned" },
    { id: "e3", dispatchPlanId: "plan-002", type: "job_scheduled", timestamp: "2026-07-22T10:00:00.000Z", description: "Other plan" },
  ];

  it("returns only events for the requested plan", () => {
    const result = getEventsForPlan(events, "plan-001");
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.dispatchPlanId === "plan-001")).toBe(true);
  });

  it("returns empty array when no events match", () => {
    expect(getEventsForPlan(events, "plan-999")).toHaveLength(0);
  });
});

// ─── formatScheduleTime ───────────────────────────────────────────────────────

describe("formatScheduleTime", () => {
  it("converts 08:00 to 8:00 AM", () => {
    expect(formatScheduleTime("08:00")).toBe("8:00 AM");
  });

  it("converts 12:00 to 12:00 PM", () => {
    expect(formatScheduleTime("12:00")).toBe("12:00 PM");
  });

  it("converts 13:30 to 1:30 PM", () => {
    expect(formatScheduleTime("13:30")).toBe("1:30 PM");
  });

  it("converts 00:00 to 12:00 AM", () => {
    expect(formatScheduleTime("00:00")).toBe("12:00 AM");
  });

  it("converts 23:45 to 11:45 PM", () => {
    expect(formatScheduleTime("23:45")).toBe("11:45 PM");
  });
});

// ─── formatTargetDate ─────────────────────────────────────────────────────────

describe("formatTargetDate", () => {
  it("formats a valid ISO date as a short human-readable string", () => {
    const result = formatTargetDate("2026-07-25");
    // Should include month and day (e.g., "Jul 25" or "Sat, Jul 25")
    expect(result).toMatch(/Jul/);
    expect(result).toMatch(/25/);
  });

  it("returns the original value for an invalid date string", () => {
    expect(formatTargetDate("not-a-date")).toBe("not-a-date");
  });

  it("returns empty string for empty input", () => {
    expect(formatTargetDate("")).toBe("");
  });
});

// ─── getLocalTodayISO ────────────────────────────────────────────────────────

describe("getLocalTodayISO", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T10:30:00.000"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns today's date in YYYY-MM-DD format", () => {
    const today = getLocalTodayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today).toBe("2026-07-27");
  });

  it("result has correct month and day components", () => {
    const [year, month, day] = getLocalTodayISO().split("-");
    expect(year).toBe("2026");
    expect(month).toBe("07");
    expect(day).toBe("27");
  });
});
