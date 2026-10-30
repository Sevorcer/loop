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

  it("draws one card and one crew block when a job has several plans", () => {
    const aligned = alignDispatchSnapshotWithJobs(
      snapshot([
        plan({
          id: "plan-oct-31",
          targetDate: "2026-10-31",
          dispatchStatus: "completed",
          updatedAt: "2026-10-30T15:37:48.000Z",
        }),
        plan({
          id: "plan-oct-30",
          targetDate: "2026-10-30",
          dispatchStatus: "completed",
          updatedAt: "2026-10-30T15:22:30.000Z",
        }),
      ]),
      [
        {
          id: "job-1",
          status: "Completed",
          scheduledFor: "2026-10-30",
          scheduledStartAt: "2026-10-30T21:00:00.000Z",
          scheduledEndAt: "2026-10-31T00:00:00.000Z",
          assignedTo: "Alex Tech",
        },
      ],
    );

    expect(aligned.dispatchPlans).toHaveLength(1);
    expect(aligned.dispatchPlans[0].id).toBe("plan-oct-30");
    expect(aligned.dispatchPlans[0].targetDate).toBe("2026-10-30");
    expect(aligned.dispatchPlans[0].dispatchStatus).toBe("completed");
    expect(aligned.scheduleBlocks).toHaveLength(1);
    expect(aligned.scheduleBlocks[0]).toMatchObject({
      dispatchPlanId: "plan-oct-30",
      jobId: "job-1",
      scheduledDate: "2026-10-30",
      scheduledStartTime: "14:00",
      scheduledEndTime: "17:00",
    });
    expect(aligned.metrics.totalPlans).toBe(1);
    expect(aligned.metrics.inProgress).toBe(0);
  });

  it("collapses three in-progress copies of one job to a single card", () => {
    const aligned = alignDispatchSnapshotWithJobs(
      snapshot([
        plan({ id: "day-1", targetDate: "2026-09-30", dispatchStatus: "in_progress" }),
        plan({ id: "day-2", targetDate: "2026-10-01", dispatchStatus: "in_progress", updatedAt: "2026-10-01T04:38:11.000Z" }),
        plan({ id: "day-3", targetDate: "2026-10-02", dispatchStatus: "ready_to_schedule", updatedAt: "2026-10-01T04:38:11.000Z" }),
      ]),
      [
        {
          id: "job-1",
          status: "In Progress",
          scheduledFor: "2026-09-30",
          scheduledStartAt: "2026-09-30T15:00:00.000Z",
          scheduledEndAt: "2026-10-02T15:00:00.000Z",
          assignedTo: "Antonio Vilchez",
        },
      ],
    );

    expect(aligned.dispatchPlans.map((item) => item.id)).toEqual(["day-1"]);
    expect(aligned.dispatchPlans[0].dispatchStatus).toBe("in_progress");
    expect(aligned.dispatchPlans[0].targetDate).toBe("2026-09-30");
    expect(aligned.scheduleBlocks).toHaveLength(1);
    expect(aligned.metrics.inProgress).toBe(1);
  });
});
