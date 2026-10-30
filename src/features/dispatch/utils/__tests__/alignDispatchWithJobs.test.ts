import { describe, expect, it } from "vitest";

import type { DispatchPlan, DispatchSnapshot } from "../types/dispatch";
import { alignDispatchSnapshotWithJobs } from "../alignDispatchWithJobs";

function plan(overrides: Partial<DispatchPlan> = {}): DispatchPlan {
  return {
    id: "plan-1",
    jobId: "job-1",
    jobNumber: "JOB-200",
    customerName: "Ada",
    propertyName: "Ada House",
    jobType: "Service",
    dispatchStatus: "ready_to_schedule",
    dispatchability: {
      isDispatchable: false,
      materialReadiness: { state: "not_satisfied", reason: "" },
      technicalReadiness: { state: "not_satisfied", reason: "" },
      customerReadiness: { state: "not_satisfied", reason: "" },
      crewReadiness: { state: "not_satisfied", reason: "" },
    },
    targetDate: "2026-10-31",
    estimatedDurationHours: 4,
    priority: "normal",
    constraints: [],
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
    ...overrides,
  };
}

function snapshot(plans: DispatchPlan[]): DispatchSnapshot {
  return {
    dispatchPlans: plans,
    crewAssignments: [],
    scheduleBlocks: [],
    dispatchEvents: [],
    crews: [],
    metrics: {
      readyToSchedule: 1,
      scheduled: 0,
      inProgress: 0,
      awaitingMaterials: 0,
      awaitingTechnicalReadiness: 0,
      awaitingCustomer: 0,
      awaitingCrew: 0,
      totalPlans: plans.length,
    },
  };
}

describe("alignDispatchSnapshotWithJobs", () => {
  it("places a 2:00–5:00 PM Pacific job on Oct 30 for 3 hours, not Ready to Schedule", () => {
    const aligned = alignDispatchSnapshotWithJobs(snapshot([plan()]), [
      {
        id: "job-1",
        status: "Scheduled",
        scheduledFor: "2026-10-30",
        scheduledStartAt: "2026-10-30T21:00:00.000Z",
        scheduledEndAt: "2026-10-31T00:00:00.000Z",
        assignedTo: "Alex Tech",
      },
    ]);

    const next = aligned.dispatchPlans[0];
    expect(next.dispatchStatus).toBe("scheduled");
    expect(next.targetDate).toBe("2026-10-30");
    expect(next.estimatedDurationHours).toBe(3);
    expect(aligned.scheduleBlocks).toHaveLength(1);
    expect(aligned.scheduleBlocks[0]).toMatchObject({
      scheduledDate: "2026-10-30",
      scheduledStartTime: "14:00",
      scheduledEndTime: "17:00",
      estimatedDurationHours: 3,
      crewName: "Alex Tech",
    });
  });

  it("keeps a completed job on that day's board", () => {
    const aligned = alignDispatchSnapshotWithJobs(snapshot([plan({ dispatchStatus: "scheduled" })]), [
      {
        id: "job-1",
        status: "Completed",
        scheduledFor: "2026-10-30",
        scheduledStartAt: "2026-10-30T21:00:00.000Z",
        scheduledEndAt: "2026-10-31T00:00:00.000Z",
        assignedTo: "Alex Tech",
      },
    ]);

    expect(aligned.dispatchPlans[0].dispatchStatus).toBe("completed");
    expect(aligned.scheduleBlocks[0].dispatchStatus).toBe("completed");
    expect(aligned.scheduleBlocks[0].scheduledDate).toBe("2026-10-30");
  });
});
