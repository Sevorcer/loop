import { describe, it, expect } from "vitest";

import type { Job } from "@/features/jobs/types/job";
import type { DispatchPlan } from "@/features/dispatch/types/dispatch";
import {
  normalizeJobStatus,
  isOpenJob,
  isInProgress,
  isOnHold,
  buildProblemJobs,
  aggregateCrewWorkload,
  computeKPIs,
  KPI_DEFINITIONS,
  formatAvgHours,
  formatScheduledDate,
} from "../utils/commandCenterUtils";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-001",
    jobNumber: "JOB-1001",
    title: "Test Job",
    type: "Install",
    status: "Scheduled",
    priority: "Medium",
    customerName: "Test Customer",
    propertyName: "Test Property",
    assignedTo: "Marcus Rivera",
    scheduledFor: "2026-07-28",
    summary: "",
    location: "",
    notes: "",
    ...overrides,
  };
}

function makeDispatchPlan(overrides: Partial<DispatchPlan> = {}): DispatchPlan {
  return {
    id: "dp-001",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    customerName: "Test Customer",
    propertyName: "Test Property",
    jobType: "Install",
    dispatchStatus: "scheduled",
    dispatchability: {
      isDispatchable: true,
      materialReadiness: { state: "satisfied", reason: "" },
      technicalReadiness: { state: "satisfied", reason: "" },
      customerReadiness: { state: "satisfied", reason: "" },
      crewReadiness: { state: "satisfied", reason: "" },
    },
    targetDate: "2026-07-28",
    estimatedDurationHours: 6,
    priority: "normal",
    constraints: [],
    createdAt: "2026-07-28T00:00:00Z",
    updatedAt: "2026-07-28T00:00:00Z",
    ...overrides,
  };
}

// ─── normalizeJobStatus ───────────────────────────────────────────────────────

describe("normalizeJobStatus", () => {
  it("normalizes title-case DB values", () => {
    expect(normalizeJobStatus("Scheduled")).toBe("Scheduled");
    expect(normalizeJobStatus("In Progress")).toBe("In Progress");
    expect(normalizeJobStatus("On Hold")).toBe("On Hold");
    expect(normalizeJobStatus("Completed")).toBe("Completed");
    expect(normalizeJobStatus("Cancelled")).toBe("Cancelled");
  });

  it("normalizes snake_case legacy variants", () => {
    expect(normalizeJobStatus("in_progress")).toBe("In Progress");
    expect(normalizeJobStatus("on_hold")).toBe("On Hold");
    expect(normalizeJobStatus("completed")).toBe("Completed");
    expect(normalizeJobStatus("cancelled")).toBe("Cancelled");
  });

  it("normalizes lowercase space-separated variants", () => {
    expect(normalizeJobStatus("in progress")).toBe("In Progress");
    expect(normalizeJobStatus("on hold")).toBe("On Hold");
  });

  it("normalizes waiting-on-parts variants to On Hold", () => {
    expect(normalizeJobStatus("Waiting on Parts")).toBe("On Hold");
    expect(normalizeJobStatus("waiting_on_parts")).toBe("On Hold");
  });

  it("returns null for unknown values", () => {
    expect(normalizeJobStatus("unknown")).toBeNull();
    expect(normalizeJobStatus("")).toBeNull();
  });
});

// ─── isOpenJob / isInProgress / isOnHold ─────────────────────────────────────

describe("job status helpers", () => {
  it("isOpenJob returns false for Completed and Cancelled", () => {
    expect(isOpenJob(makeJob({ status: "Completed" }))).toBe(false);
    expect(isOpenJob(makeJob({ status: "Cancelled" }))).toBe(false);
  });

  it("isOpenJob returns true for Scheduled, In Progress, On Hold", () => {
    expect(isOpenJob(makeJob({ status: "Scheduled" }))).toBe(true);
    expect(isOpenJob(makeJob({ status: "In Progress" }))).toBe(true);
    expect(isOpenJob(makeJob({ status: "On Hold" }))).toBe(true);
  });

  it("isInProgress returns true only for In Progress", () => {
    expect(isInProgress(makeJob({ status: "In Progress" }))).toBe(true);
    expect(isInProgress(makeJob({ status: "Scheduled" }))).toBe(false);
  });

  it("isOnHold returns true only for On Hold", () => {
    expect(isOnHold(makeJob({ status: "On Hold" }))).toBe(true);
    expect(isOnHold(makeJob({ status: "In Progress" }))).toBe(false);
  });
});

// ─── buildProblemJobs ─────────────────────────────────────────────────────────

describe("buildProblemJobs", () => {
  const today = "2026-07-28";

  it("returns empty array when all lists are empty", () => {
    expect(buildProblemJobs([], [], [])).toEqual([]);
  });

  it("deduplicates a job that appears in multiple lists", () => {
    const job = makeJob({ id: "job-dup", scheduledFor: "2026-07-25" });
    const result = buildProblemJobs([job], [job], [job]);
    expect(result).toHaveLength(1);
    expect(result[0].reasons).toHaveLength(3);
    expect(result[0].reasons).toContain("late");
    expect(result[0].reasons).toContain("unassigned");
    expect(result[0].reasons).toContain("on_hold");
  });

  it("assigns correct reasons for each source", () => {
    const lateJob = makeJob({ id: "job-late" });
    const unassignedJob = makeJob({ id: "job-unassigned" });
    const holdJob = makeJob({ id: "job-hold" });

    const result = buildProblemJobs([lateJob], [unassignedJob], [holdJob]);
    expect(result).toHaveLength(3);

    const lateEntry = result.find((r) => r.job.id === "job-late")!;
    expect(lateEntry.reasons).toEqual(["late"]);

    const unassignedEntry = result.find((r) => r.job.id === "job-unassigned")!;
    expect(unassignedEntry.reasons).toEqual(["unassigned"]);

    const holdEntry = result.find((r) => r.job.id === "job-hold")!;
    expect(holdEntry.reasons).toEqual(["on_hold"]);
  });

  it("sorts High priority before Medium before Low", () => {
    const lowJob = makeJob({ id: "low", priority: "Low" });
    const highJob = makeJob({ id: "high", priority: "High" });
    const medJob = makeJob({ id: "med", priority: "Medium" });

    const result = buildProblemJobs([lowJob, highJob, medJob], [], []);
    expect(result[0].job.id).toBe("high");
    expect(result[1].job.id).toBe("med");
    expect(result[2].job.id).toBe("low");
  });

  it("within same priority, places late jobs before non-late jobs", () => {
    const lateHigh = makeJob({ id: "late-high", priority: "High" });
    const nonLateHigh = makeJob({ id: "nonlate-high", priority: "High" });

    // lateHigh is in late list, nonLateHigh is only in unassigned
    const result = buildProblemJobs([lateHigh], [nonLateHigh], []);
    expect(result[0].job.id).toBe("late-high");
    expect(result[1].job.id).toBe("nonlate-high");
  });

  it("is deterministic for same-priority non-late jobs", () => {
    const b = makeJob({
      id: "b",
      jobNumber: "JOB-1002",
      priority: "Medium",
      scheduledFor: "2026-07-30",
    });
    const a = makeJob({
      id: "a",
      jobNumber: "JOB-1001",
      priority: "Medium",
      scheduledFor: "2026-07-29",
    });

    const result = buildProblemJobs([], [b, a], []);
    expect(result.map((entry) => entry.job.id)).toEqual(["a", "b"]);
  });

  it("a job appearing in late + unassigned gets both reasons and is not duplicated", () => {
    const job = makeJob({ id: "j1" });
    const result = buildProblemJobs([job], [job], []);
    expect(result).toHaveLength(1);
    expect(result[0].reasons).toContain("late");
    expect(result[0].reasons).toContain("unassigned");
  });

  void today; // used conceptually above for date-based tests
});

// ─── aggregateCrewWorkload ────────────────────────────────────────────────────

describe("aggregateCrewWorkload", () => {
  const today = "2026-07-28";

  it("returns empty array for no jobs", () => {
    expect(aggregateCrewWorkload([], today)).toEqual([]);
  });

  it("skips jobs with no assigned technician", () => {
    const jobs = [makeJob({ assignedTo: "", id: "j1" })];
    expect(aggregateCrewWorkload(jobs, today)).toEqual([]);
  });

  it("groups correctly by technician name", () => {
    const jobs = [
      makeJob({ id: "j1", assignedTo: "Alice", status: "Scheduled" }),
      makeJob({ id: "j2", assignedTo: "Alice", status: "In Progress" }),
      makeJob({ id: "j3", assignedTo: "Bob", status: "Scheduled" }),
    ];
    const result = aggregateCrewWorkload(jobs, today);
    const alice = result.find((e) => e.technicianName === "Alice")!;
    const bob = result.find((e) => e.technicianName === "Bob")!;

    expect(alice.assignedCount).toBe(2);
    expect(alice.inProgressCount).toBe(1);
    expect(bob.assignedCount).toBe(1);
  });

  it("marks on-hold jobs as at-risk", () => {
    const jobs = [makeJob({ id: "j1", assignedTo: "Alice", status: "On Hold" })];
    const result = aggregateCrewWorkload(jobs, today);
    expect(result[0].atRiskCount).toBe(1);
  });

  it("marks late jobs as at-risk", () => {
    const jobs = [
      makeJob({ id: "j1", assignedTo: "Alice", scheduledFor: "2026-07-01", status: "Scheduled" }),
    ];
    const result = aggregateCrewWorkload(jobs, today);
    expect(result[0].atRiskCount).toBe(1);
  });

  it("sorts technicians by atRiskCount descending", () => {
    const jobs = [
      makeJob({ id: "j1", assignedTo: "Safe", status: "Scheduled" }),
      makeJob({ id: "j2", assignedTo: "Risky", status: "On Hold" }),
    ];
    const result = aggregateCrewWorkload(jobs, today);
    expect(result[0].technicianName).toBe("Risky");
  });

  it("sort is deterministic when risk and load are tied", () => {
    const jobs = [
      makeJob({ id: "j1", assignedTo: "Zed", status: "Scheduled" }),
      makeJob({ id: "j2", assignedTo: "Amy", status: "Scheduled" }),
    ];
    const result = aggregateCrewWorkload(jobs, today);
    expect(result.map((entry) => entry.technicianName)).toEqual(["Amy", "Zed"]);
  });
});

// ─── computeKPIs ─────────────────────────────────────────────────────────────

describe("computeKPIs", () => {
  const today = "2026-07-28";

  it("computes jobsToday from scheduledToday", () => {
    const snapshot = {
      today,
      scheduledToday: [makeJob(), makeJob({ id: "j2" })],
      inProgress: [],
      onHold: [],
      inspections: [],
      callbacks: [],
      unassigned: [],
      late: [],
      completedToday: [],
      dispatchPlans: [],
    };
    const kpis = computeKPIs(snapshot);
    expect(kpis.jobsToday).toBe(2);
  });

  it("counts crewsDispatched as distinct non-empty assigned_to in inProgress", () => {
    const snapshot = {
      today,
      scheduledToday: [],
      inProgress: [
        makeJob({ id: "j1", assignedTo: "Alice" }),
        makeJob({ id: "j2", assignedTo: "Alice" }),
        makeJob({ id: "j3", assignedTo: "Bob" }),
      ],
      onHold: [],
      inspections: [],
      callbacks: [],
      unassigned: [],
      late: [],
      completedToday: [],
      dispatchPlans: [],
    };
    const kpis = computeKPIs(snapshot);
    expect(kpis.crewsDispatched).toBe(2);
  });

  it("computes waitingOnPermit from blocking permit constraints", () => {
    const snapshot = {
      today,
      scheduledToday: [],
      inProgress: [],
      onHold: [],
      inspections: [],
      callbacks: [],
      unassigned: [],
      late: [],
      completedToday: [],
      dispatchPlans: [
        makeDispatchPlan({
          id: "dp-1",
          constraints: [{ label: "Permit required on-site", severity: "blocking" }],
        }),
        makeDispatchPlan({
          id: "dp-2",
          constraints: [{ label: "Crane permit required", severity: "blocking" }],
        }),
        makeDispatchPlan({
          id: "dp-3",
          constraints: [{ label: "Roof access required", severity: "warning" }],
        }),
        makeDispatchPlan({
          id: "dp-4",
          constraints: [{ label: "Nothing special", severity: "note" }],
        }),
      ],
    };
    const kpis = computeKPIs(snapshot);
    expect(kpis.waitingOnPermit).toBe(2);
  });

  it("returns null for avgCompletionHours when no completed plans for today", () => {
    const snapshot = {
      today,
      scheduledToday: [],
      inProgress: [],
      onHold: [],
      inspections: [],
      callbacks: [],
      unassigned: [],
      late: [],
      completedToday: [],
      dispatchPlans: [
        makeDispatchPlan({ dispatchStatus: "completed", targetDate: "2026-07-27" }),
      ],
    };
    const kpis = computeKPIs(snapshot);
    expect(kpis.avgCompletionHours).toBeNull();
  });

  it("computes avgCompletionHours for completed plans matching today", () => {
    const snapshot = {
      today,
      scheduledToday: [],
      inProgress: [],
      onHold: [],
      inspections: [],
      callbacks: [],
      unassigned: [],
      late: [],
      completedToday: [],
      dispatchPlans: [
        makeDispatchPlan({
          id: "dp-1",
          dispatchStatus: "completed",
          targetDate: today,
          estimatedDurationHours: 6,
        }),
        makeDispatchPlan({
          id: "dp-2",
          dispatchStatus: "completed",
          targetDate: today,
          estimatedDurationHours: 8,
        }),
      ],
    };
    const kpis = computeKPIs(snapshot);
    expect(kpis.avgCompletionHours).toBe(7);
  });
});

// ─── KPI_DEFINITIONS completeness ────────────────────────────────────────────

describe("KPI_DEFINITIONS", () => {
  it("covers all keys in CommandCenterKPIs", () => {
    const expectedKeys: Array<string> = [
      "jobsToday",
      "crewsDispatched",
      "waitingOnInspection",
      "waitingOnPermit",
      "callbacks",
      "completedToday",
      "jobsRunningLate",
      "avgCompletionHours",
    ];
    const definedKeys = KPI_DEFINITIONS.map((d) => d.key);
    for (const key of expectedKeys) {
      expect(definedKeys).toContain(key);
    }
  });

  it("every definition has a non-empty label, description, and href", () => {
    for (const def of KPI_DEFINITIONS) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.href.startsWith("/")).toBe(true);
    }
  });
});

// ─── Format helpers ───────────────────────────────────────────────────────────

describe("formatAvgHours", () => {
  it("returns — for null", () => {
    expect(formatAvgHours(null)).toBe("—");
  });

  it("formats a number with 'h' suffix", () => {
    expect(formatAvgHours(6.5)).toBe("6.5 h");
    expect(formatAvgHours(7)).toBe("7 h");
  });
});

describe("formatScheduledDate", () => {
  it("returns 'Unscheduled' for null", () => {
    expect(formatScheduledDate(null)).toBe("Unscheduled");
  });

  it("returns 'Unscheduled' for undefined", () => {
    expect(formatScheduledDate(undefined)).toBe("Unscheduled");
  });

  it("returns 'Unscheduled' for empty string", () => {
    expect(formatScheduledDate("")).toBe("Unscheduled");
  });

  it("formats a valid ISO date to short month-day", () => {
    const result = formatScheduledDate("2026-07-28");
    expect(result).toMatch(/Jul\s+28/);
  });

  it("returns the raw string for invalid dates", () => {
    expect(formatScheduledDate("not-a-date")).toBe("not-a-date");
  });
});
