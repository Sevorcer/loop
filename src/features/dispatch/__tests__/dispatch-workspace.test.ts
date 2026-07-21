import { describe, expect, it } from "vitest";

import type { DispatchEvent, DispatchPlan, DispatchSnapshot } from "../types/dispatch";
import {
  buildDispatchQueueSections,
  getDispatchQueueMetrics,
  sortDispatchEvents,
} from "../utils/dispatchWorkspace";

function createPlan(
  id: string,
  dispatchStatus: DispatchPlan["dispatchStatus"],
  priority: DispatchPlan["priority"],
  targetDate: string,
): DispatchPlan {
  return {
    id,
    jobId: id,
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
    estimatedDurationHours: 8,
    priority,
    constraints: [],
    createdAt: "2026-07-20T09:00:00.000Z",
    updatedAt: "2026-07-20T09:00:00.000Z",
  };
}

describe("dispatchWorkspace", () => {
  it("builds queue sections from dispatch plan state", () => {
    const sections = buildDispatchQueueSections([
      createPlan("1", "scheduled", "normal", "2026-07-25"),
      createPlan("2", "ready_to_schedule", "urgent", "2026-07-22"),
      createPlan("3", "awaiting_customer_confirmation", "high", "2026-07-23"),
      createPlan("4", "in_progress", "normal", "2026-07-21"),
    ]);

    expect(sections.find((section) => section.key === "ready")?.plans.map((plan) => plan.id)).toEqual([
      "2",
    ]);
    expect(
      sections.find((section) => section.key === "blocked")?.plans.map((plan) => plan.id),
    ).toEqual(["3"]);
  });

  it("sorts plans by priority before target date", () => {
    const sections = buildDispatchQueueSections([
      createPlan("slow", "ready_to_schedule", "normal", "2026-07-21"),
      createPlan("urgent", "ready_to_schedule", "urgent", "2026-07-25"),
      createPlan("high", "ready_to_schedule", "high", "2026-07-22"),
    ]);

    expect(sections.find((section) => section.key === "ready")?.plans.map((plan) => plan.id)).toEqual([
      "urgent",
      "high",
      "slow",
    ]);
  });

  it("includes technical-readiness blockers in queue metrics", () => {
    const metrics: DispatchSnapshot["metrics"] = {
      readyToSchedule: 2,
      scheduled: 3,
      inProgress: 1,
      awaitingMaterials: 1,
      awaitingTechnicalReadiness: 2,
      awaitingCustomer: 1,
      awaitingCrew: 1,
      totalPlans: 10,
    };

    expect(getDispatchQueueMetrics(metrics)).toEqual({
      active: 1,
      ready: 2,
      scheduled: 3,
      blocked: 5,
      total: 10,
    });
  });

  it("sorts dispatch events newest-first", () => {
    const events: DispatchEvent[] = [
      {
        id: "older",
        dispatchPlanId: "1",
        type: "dispatch_plan_created",
        timestamp: "2026-07-20T09:00:00.000Z",
        description: "Older",
      },
      {
        id: "newer",
        dispatchPlanId: "1",
        type: "job_scheduled",
        timestamp: "2026-07-21T09:00:00.000Z",
        description: "Newer",
      },
    ];

    expect(sortDispatchEvents(events).map((event) => event.id)).toEqual([
      "newer",
      "older",
    ]);
  });
});
