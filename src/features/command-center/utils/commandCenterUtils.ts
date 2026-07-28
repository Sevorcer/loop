// ============================================================
// Command Center — Derivation Utilities
// Sprint 6 / Epic 9
//
// Pure functions with no DB or React dependencies.
// All KPI computation and aggregation happens here so that:
//  1. Logic is unit-testable in isolation.
//  2. CommandCenterScreen remains a thin composition layer.
// ============================================================

import type { Job } from "@/features/jobs/types/job";
import type { DispatchPlan } from "@/features/dispatch/types/dispatch";
import { normalizeJobStatus as normalizeSharedJobStatus, isOpenStatus } from "@/lib/jobs/status";
import { COMMAND_CENTER_KPI_DEFINITIONS } from "@/lib/operationsMetricDefinitions";
import type {
  CommandCenterKPIs,
  CommandCenterSnapshot,
  CrewWorkloadEntry,
  NormalizedJobStatus,
  ProblemJob,
  ProblemReason,
} from "../types/commandCenter";

// ------------------------------------------------------------------
// Status Normalizer
//
// Canonical mapping from any status representation used in the DB or
// legacy code to the NormalizedJobStatus union.  All widget and KPI
// filters MUST use this normalizer instead of raw string comparisons.
// ------------------------------------------------------------------

export function normalizeJobStatus(raw: string): NormalizedJobStatus | null {
  return normalizeSharedJobStatus(raw);
}

/** Returns true when the job is still operationally open. */
export function isOpenJob(job: Job): boolean {
  return isOpenStatus(job.status as string);
}

/** Returns true when the job is In Progress. */
export function isInProgress(job: Job): boolean {
  return normalizeJobStatus(job.status as string) === "In Progress";
}

/** Returns true when the job is On Hold. */
export function isOnHold(job: Job): boolean {
  return normalizeJobStatus(job.status as string) === "On Hold";
}

/** Returns true when the job is Completed. */
export function isCompleted(job: Job): boolean {
  return normalizeJobStatus(job.status as string) === "Completed";
}

// ------------------------------------------------------------------
// KPI Definitions
//
// A single authoritative map drives both computation and display.
// Each entry is a pure-function reducer over the snapshot data so
// the same logic is used for display, testing, and future export.
// ------------------------------------------------------------------

export interface KPIDefinition {
  key: keyof CommandCenterKPIs;
  label: string;
  /** Short description shown below the metric value. */
  description: string;
  /** Optional explainability hint for non-obvious calculations. */
  helpText?: string;
  /**
   * The route or query-string to navigate to when the KPI is clicked.
   * Used by KPIStrip to make every metric actionable.
   */
  href: string;
  /** Derivation logic run against the raw snapshot data. */
  compute: (snapshot: Omit<CommandCenterSnapshot, "kpis" | "crewWorkload" | "problemJobs">) => number | null;
}

export const KPI_DEFINITIONS: readonly KPIDefinition[] = [
  {
    key: "jobsToday",
    label: COMMAND_CENTER_KPI_DEFINITIONS.jobsToday.label,
    description: COMMAND_CENTER_KPI_DEFINITIONS.jobsToday.description,
    helpText: COMMAND_CENTER_KPI_DEFINITIONS.jobsToday.helpText,
    href: COMMAND_CENTER_KPI_DEFINITIONS.jobsToday.href,
    compute: ({ scheduledToday }) => scheduledToday.length,
  },
  {
    key: "crewsDispatched",
    label: COMMAND_CENTER_KPI_DEFINITIONS.crewsDispatched.label,
    description: COMMAND_CENTER_KPI_DEFINITIONS.crewsDispatched.description,
    helpText: COMMAND_CENTER_KPI_DEFINITIONS.crewsDispatched.helpText,
    href: COMMAND_CENTER_KPI_DEFINITIONS.crewsDispatched.href,
    compute: ({ inProgress }) => {
      const names = new Set<string>();
      for (const job of inProgress) {
        if (job.assignedTo && job.assignedTo.trim() !== "") {
          names.add(job.assignedTo.trim());
        }
      }
      return names.size;
    },
  },
  {
    key: "waitingOnInspection",
    label: COMMAND_CENTER_KPI_DEFINITIONS.waitingOnInspection.label,
    description: COMMAND_CENTER_KPI_DEFINITIONS.waitingOnInspection.description,
    helpText: COMMAND_CENTER_KPI_DEFINITIONS.waitingOnInspection.helpText,
    href: COMMAND_CENTER_KPI_DEFINITIONS.waitingOnInspection.href,
    compute: ({ inspections }) => inspections.length,
  },
  {
    key: "waitingOnPermit",
    label: COMMAND_CENTER_KPI_DEFINITIONS.waitingOnPermit.label,
    description: COMMAND_CENTER_KPI_DEFINITIONS.waitingOnPermit.description,
    helpText: COMMAND_CENTER_KPI_DEFINITIONS.waitingOnPermit.helpText,
    href: COMMAND_CENTER_KPI_DEFINITIONS.waitingOnPermit.href,
    compute: ({ dispatchPlans }) => countWaitingOnPermit(dispatchPlans),
  },
  {
    key: "callbacks",
    label: COMMAND_CENTER_KPI_DEFINITIONS.callbacks.label,
    description: COMMAND_CENTER_KPI_DEFINITIONS.callbacks.description,
    helpText: COMMAND_CENTER_KPI_DEFINITIONS.callbacks.helpText,
    href: COMMAND_CENTER_KPI_DEFINITIONS.callbacks.href,
    compute: ({ callbacks }) => callbacks.length,
  },
  {
    key: "completedToday",
    label: COMMAND_CENTER_KPI_DEFINITIONS.completedToday.label,
    description: COMMAND_CENTER_KPI_DEFINITIONS.completedToday.description,
    helpText: COMMAND_CENTER_KPI_DEFINITIONS.completedToday.helpText,
    href: COMMAND_CENTER_KPI_DEFINITIONS.completedToday.href,
    compute: ({ completedToday }) => completedToday.length,
  },
  {
    key: "jobsRunningLate",
    label: COMMAND_CENTER_KPI_DEFINITIONS.jobsRunningLate.label,
    description: COMMAND_CENTER_KPI_DEFINITIONS.jobsRunningLate.description,
    helpText: COMMAND_CENTER_KPI_DEFINITIONS.jobsRunningLate.helpText,
    href: COMMAND_CENTER_KPI_DEFINITIONS.jobsRunningLate.href,
    compute: ({ late }) => late.length,
  },
  {
    key: "avgCompletionHours",
    label: COMMAND_CENTER_KPI_DEFINITIONS.avgCompletionHours.label,
    description: COMMAND_CENTER_KPI_DEFINITIONS.avgCompletionHours.description,
    helpText: COMMAND_CENTER_KPI_DEFINITIONS.avgCompletionHours.helpText,
    href: COMMAND_CENTER_KPI_DEFINITIONS.avgCompletionHours.href,
    compute: ({ dispatchPlans, today }) => computeAvgCompletionHours(dispatchPlans, today),
  },
] as const;

// ------------------------------------------------------------------
// Waiting on Permit
// Application-side computation from dispatch plan constraint JSONB.
// No DB index backing this — acceptable at current scale.
// Sprint 8: add a dedicated DB column/index if query load warrants it.
// ------------------------------------------------------------------

function countWaitingOnPermit(plans: DispatchPlan[]): number {
  return plans.filter((plan) =>
    plan.constraints.some(
      (c) =>
        c.severity === "blocking" &&
        c.label.toLowerCase().includes("permit"),
    ),
  ).length;
}

// ------------------------------------------------------------------
// Average Completion Time
// Uses estimated_duration_hours from dispatch plans with
// dispatch_status='completed' targeting today's target_date.
// NOTE: estimated duration, not actual measured time.
// Sprint 8: add job start/end timestamps for real measurement.
// ------------------------------------------------------------------

function computeAvgCompletionHours(
  plans: DispatchPlan[],
  today: string,
): number | null {
  const completed = plans.filter(
    (p) => p.dispatchStatus === "completed" && p.targetDate === today,
  );
  if (completed.length === 0) return null;
  const total = completed.reduce((sum, p) => sum + p.estimatedDurationHours, 0);
  return Math.round((total / completed.length) * 10) / 10;
}

// ------------------------------------------------------------------
// KPI Computation
// Derives all KPI values from the raw snapshot data using KPI_DEFINITIONS.
// ------------------------------------------------------------------

export function computeKPIs(
  snapshot: Omit<CommandCenterSnapshot, "kpis" | "crewWorkload" | "problemJobs">,
): CommandCenterKPIs {
  const result = {} as Record<string, number | null>;
  for (const def of KPI_DEFINITIONS) {
    result[def.key] = def.compute(snapshot);
  }
  return result as unknown as CommandCenterKPIs;
}

// ------------------------------------------------------------------
// Crew Workload Aggregation
// Groups jobs by assigned_to (technician name).
// at-risk = late OR on-hold.
// ------------------------------------------------------------------

export function aggregateCrewWorkload(
  allOpenJobs: Job[],
  today: string,
): CrewWorkloadEntry[] {
  const map = new Map<string, CrewWorkloadEntry>();

  for (const job of allOpenJobs) {
    const tech = job.assignedTo?.trim();
    if (!tech) continue;

    if (!map.has(tech)) {
      map.set(tech, {
        technicianName: tech,
        assignedCount: 0,
        inProgressCount: 0,
        atRiskCount: 0,
      });
    }

    const entry = map.get(tech)!;
    entry.assignedCount += 1;

    if (isInProgress(job)) {
      entry.inProgressCount += 1;
    }

    const isLate = isOpenJob(job) && job.scheduledFor < today;
    const isHeld = isOnHold(job);

    if (isLate || isHeld) {
      entry.atRiskCount += 1;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      b.atRiskCount - a.atRiskCount ||
      b.assignedCount - a.assignedCount ||
      a.technicianName.localeCompare(b.technicianName, "en"),
  );
}

// ------------------------------------------------------------------
// Problem Jobs
// Merges late + unassigned + on-hold jobs into a deduplicated,
// priority-sorted list. Each entry carries all applicable reasons.
// ------------------------------------------------------------------

const JOB_PRIORITY_RANK: Record<string, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

export function buildProblemJobs(
  late: Job[],
  unassigned: Job[],
  onHold: Job[],
): ProblemJob[] {
  const reasonMap = new Map<string, { job: Job; reasons: Set<ProblemReason> }>();

  function add(job: Job, reason: ProblemReason) {
    const existing = reasonMap.get(job.id);
    if (existing) {
      existing.reasons.add(reason);
    } else {
      reasonMap.set(job.id, { job, reasons: new Set([reason]) });
    }
  }

  for (const job of late) add(job, "late");
  for (const job of unassigned) add(job, "unassigned");
  for (const job of onHold) add(job, "on_hold");

  return Array.from(reasonMap.values())
    .map(({ job, reasons }) => ({ job, reasons: Array.from(reasons) }))
    .sort((a, b) => {
      const pa = JOB_PRIORITY_RANK[a.job.priority] ?? 99;
      const pb = JOB_PRIORITY_RANK[b.job.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      // Secondary: late jobs first
      const aLate = a.reasons.includes("late") ? 0 : 1;
      const bLate = b.reasons.includes("late") ? 0 : 1;
      if (aLate !== bLate) return aLate - bLate;

      const scheduledCmp = a.job.scheduledFor.localeCompare(b.job.scheduledFor);
      if (scheduledCmp !== 0) return scheduledCmp;

      const numberCmp = a.job.jobNumber.localeCompare(b.job.jobNumber, "en");
      if (numberCmp !== 0) return numberCmp;

      return a.job.id.localeCompare(b.job.id);
    });
}

// ------------------------------------------------------------------
// Format helpers
// ------------------------------------------------------------------

/** Format avg hours as a human-readable string, e.g. "6.5 h" or "—". */
export function formatAvgHours(value: number | null): string {
  if (value === null) return "—";
  return `${value} h`;
}

/** Format a scheduled date to a short display string, e.g. "Jul 28". */
export function formatScheduledDate(isoDate: string): string {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
