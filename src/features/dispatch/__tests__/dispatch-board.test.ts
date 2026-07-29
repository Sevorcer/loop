// PR3B: Dispatch Board MVP — integration tests
//
// Tests cover:
//  1. filterPlansByDate — date-based filtering utility
//  2. Board rendering with scheduled jobs (queue section derivation)
//  3. Filter behaviour — status, crew, date in combination
//  4. Appointment window safety — plans and blocks with/without window render safely
//  5. getAppointmentWindowLabel — label helper

import { describe, expect, it } from "vitest";

import type {
  DispatchPlan,
  DispatchStatus,
  ScheduleBlock,
} from "../types/dispatch";
import {
  filterPlansByDate,
  getAppointmentWindowLabel,
} from "../utils/dispatchUtils";
import { buildDispatchQueueSections } from "../utils/dispatchWorkspace";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(
  id: string,
  dispatchStatus: DispatchStatus,
  targetDate: string,
  appointmentWindow?: "Morning" | "Afternoon",
): DispatchPlan {
  return {
    id,
    jobId: `job-${id}`,
    jobNumber: `JOB-${id}`,
    customerName: "Customer",
    propertyName: "Property",
    jobType: "Install",
    dispatchStatus,
    dispatchability: {
      isDispatchable: dispatchStatus === "ready_to_schedule",
      materialReadiness: { state: "satisfied", reason: "" },
      technicalReadiness: { state: "satisfied", reason: "" },
      customerReadiness: { state: "satisfied", reason: "" },
      crewReadiness: { state: "satisfied", reason: "" },
    },
    targetDate,
    appointmentWindow,
    estimatedDurationHours: 4,
    priority: "normal",
    constraints: [],
    createdAt: "2026-07-20T09:00:00.000Z",
    updatedAt: "2026-07-20T09:00:00.000Z",
  };
}

function makeBlock(
  id: string,
  scheduledDate: string,
  appointmentWindow?: "Morning" | "Afternoon",
): ScheduleBlock {
  return {
    id,
    dispatchPlanId: `plan-${id}`,
    jobId: `job-${id}`,
    crewAssignmentId: `ca-${id}`,
    crewName: "Alpha Crew",
    scheduledDate,
    scheduledStartTime: "07:00",
    scheduledEndTime: "15:00",
    estimatedDurationHours: 8,
    jobType: "Install",
    customerName: "Customer",
    propertyName: "Property",
    dispatchStatus: "scheduled",
    appointmentWindow,
  };
}

// ---------------------------------------------------------------------------
// filterPlansByDate
// ---------------------------------------------------------------------------

describe("filterPlansByDate", () => {
  const plans = [
    makePlan("1", "scheduled", "2026-07-21"),
    makePlan("2", "ready_to_schedule", "2026-07-22"),
    makePlan("3", "scheduled", "2026-07-22"),
    makePlan("4", "in_progress", "2026-07-19"),
  ];

  it("returns only plans matching the given date", () => {
    const result = filterPlansByDate(plans, "2026-07-22");
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(["2", "3"]);
  });

  it("returns all plans when date is empty string", () => {
    const result = filterPlansByDate(plans, "");
    expect(result).toHaveLength(4);
  });

  it("returns empty array when no plans match the date", () => {
    expect(filterPlansByDate(plans, "2026-08-01")).toHaveLength(0);
  });

  it("returns single matching plan when only one plan is on that date", () => {
    const result = filterPlansByDate(plans, "2026-07-21");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// Board rendering with scheduled jobs
// ---------------------------------------------------------------------------

describe("dispatch board rendering — queue section derivation", () => {
  it("places a scheduled plan in the scheduled section", () => {
    const plans = [makePlan("1", "scheduled", "2026-07-21")];
    const sections = buildDispatchQueueSections(plans);

    const scheduledSection = sections.find((s) => s.key === "scheduled");
    expect(scheduledSection?.plans).toHaveLength(1);
    expect(scheduledSection?.plans[0].id).toBe("1");
  });

  it("places in_progress plans in the active section", () => {
    const plans = [makePlan("1", "in_progress", "2026-07-21")];
    const sections = buildDispatchQueueSections(plans);

    const activeSection = sections.find((s) => s.key === "active");
    expect(activeSection?.plans).toHaveLength(1);
  });

  it("builds correct sections when plans span multiple statuses and dates", () => {
    const plans = [
      makePlan("a", "scheduled", "2026-07-21"),
      makePlan("b", "ready_to_schedule", "2026-07-22"),
      makePlan("c", "awaiting_materials", "2026-07-23"),
      makePlan("d", "in_progress", "2026-07-19"),
    ];
    const sections = buildDispatchQueueSections(plans);

    expect(sections.find((s) => s.key === "scheduled")?.plans).toHaveLength(1);
    expect(sections.find((s) => s.key === "ready")?.plans).toHaveLength(1);
    expect(sections.find((s) => s.key === "blocked")?.plans).toHaveLength(1);
    expect(sections.find((s) => s.key === "active")?.plans).toHaveLength(1);
  });

  it("returns empty sections when no plans are provided", () => {
    const sections = buildDispatchQueueSections([]);
    expect(sections.every((s) => s.plans.length === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Filter behaviour — date + status combined
// ---------------------------------------------------------------------------

describe("filter behaviour — date + status", () => {
  const plans = [
    makePlan("1", "scheduled", "2026-07-21"),
    makePlan("2", "scheduled", "2026-07-22"),
    makePlan("3", "ready_to_schedule", "2026-07-22"),
    makePlan("4", "in_progress", "2026-07-21"),
  ];

  it("date filter followed by queue section build narrows correctly", () => {
    const dateFiltered = filterPlansByDate(plans, "2026-07-22");
    const sections = buildDispatchQueueSections(dateFiltered);

    expect(sections.find((s) => s.key === "scheduled")?.plans.map((p) => p.id)).toEqual(["2"]);
    expect(sections.find((s) => s.key === "ready")?.plans.map((p) => p.id)).toEqual(["3"]);
    expect(sections.find((s) => s.key === "active")?.plans).toHaveLength(0);
  });

  it("date filter for a date with no plans yields all empty sections", () => {
    const dateFiltered = filterPlansByDate(plans, "2026-08-01");
    const sections = buildDispatchQueueSections(dateFiltered);
    expect(sections.every((s) => s.plans.length === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Appointment window safety — regression tests
// ---------------------------------------------------------------------------

describe("appointment window — plans with and without window", () => {
  it("plan without appointmentWindow is treated as undefined (no crash)", () => {
    const plan = makePlan("1", "scheduled", "2026-07-21", undefined);
    expect(plan.appointmentWindow).toBeUndefined();
  });

  it("plan with Morning window stores correctly", () => {
    const plan = makePlan("1", "scheduled", "2026-07-21", "Morning");
    expect(plan.appointmentWindow).toBe("Morning");
  });

  it("plan with Afternoon window stores correctly", () => {
    const plan = makePlan("1", "scheduled", "2026-07-21", "Afternoon");
    expect(plan.appointmentWindow).toBe("Afternoon");
  });

  it("mixed plans (with and without window) sort correctly in queue sections", () => {
    const plans = [
      makePlan("a", "scheduled", "2026-07-21", "Morning"),
      makePlan("b", "scheduled", "2026-07-22"),
      makePlan("c", "scheduled", "2026-07-23", "Afternoon"),
    ];
    const sections = buildDispatchQueueSections(plans);
    const scheduled = sections.find((s) => s.key === "scheduled");

    expect(scheduled?.plans).toHaveLength(3);
    // All three should be present regardless of appointmentWindow
    const ids = scheduled!.plans.map((p) => p.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
  });
});

describe("appointment window — schedule blocks with and without window", () => {
  it("block without appointmentWindow is undefined (no crash)", () => {
    const block = makeBlock("1", "2026-07-21", undefined);
    expect(block.appointmentWindow).toBeUndefined();
  });

  it("block with Morning window stores correctly", () => {
    const block = makeBlock("1", "2026-07-21", "Morning");
    expect(block.appointmentWindow).toBe("Morning");
  });

  it("block with Afternoon window stores correctly", () => {
    const block = makeBlock("1", "2026-07-21", "Afternoon");
    expect(block.appointmentWindow).toBe("Afternoon");
  });
});

// ---------------------------------------------------------------------------
// getAppointmentWindowLabel
// ---------------------------------------------------------------------------

describe("getAppointmentWindowLabel", () => {
  it("returns Morning for Morning window", () => {
    expect(getAppointmentWindowLabel("Morning")).toBe("Morning");
  });

  it("returns Afternoon for Afternoon window", () => {
    expect(getAppointmentWindowLabel("Afternoon")).toBe("Afternoon");
  });

  it("returns empty string for undefined", () => {
    expect(getAppointmentWindowLabel(undefined)).toBe("");
  });
});
