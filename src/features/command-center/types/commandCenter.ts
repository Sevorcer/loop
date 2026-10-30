// ============================================================
// Command Center — Type System
// Sprint 6 / Epic 9
//
// The Command Center is the always-on install manager view.
// It surfaces risk, crew load, and intervention priorities
// so a manager can assess operational health in <60 seconds.
// ============================================================

import type { Job } from "@/features/jobs/types/job";
import type { DispatchPlan } from "@/features/dispatch/types/dispatch";
import type { CanonicalJobStatus } from "@/lib/jobs/status";

// ------------------------------------------------------------------
// Normalized status values
// Use these canonical forms throughout the Command Center.
// The DB and legacy code use Title Case; normalizeJobStatus() maps
// from any incoming variant to these strings.
// ------------------------------------------------------------------

export type NormalizedJobStatus = CanonicalJobStatus;

// ------------------------------------------------------------------
// Workload
// Open jobs counted per person, and again for the people on a job
// together. Identity comes from job assignees, then the assigned_to label.
// ------------------------------------------------------------------

export interface WorkloadEntry {
  key: string;
  label: string;
  /** Total active (non-Completed, non-Cancelled) jobs. */
  assignedCount: number;
  /** Jobs with status = 'In Progress'. */
  inProgressCount: number;
  /**
   * At-risk jobs: late (scheduled_for < today) OR on-hold.
   * Rows with atRiskCount > 0 should be visually flagged.
   */
  atRiskCount: number;
}

/** @deprecated Use WorkloadEntry. Kept so older imports still compile. */
export type CrewWorkloadEntry = WorkloadEntry;

// ------------------------------------------------------------------
// KPI Values
// Each field aligns to a definition in KPI_DEFINITIONS.
// ------------------------------------------------------------------

export interface CommandCenterKPIs {
  /** Jobs scheduled for today (status ≠ Cancelled). */
  jobsToday: number;
  /** Distinct people with an In-Progress job. */
  crewsDispatched: number;
  /** Open inspection-type jobs (type=Inspection, status≠Completed/Cancelled). */
  waitingOnInspection: number;
  /**
   * Dispatch plans whose constraints JSONB contains a blocking permit entry.
   * Computed application-side from fetched dispatch plans.
   * NOTE: no DB index backing this; acceptable at current scale.
   */
  waitingOnPermit: number;
  /** Open jobs matching "callback" pattern in title or notes. */
  callbacks: number;
  /**
   * Jobs completed today using best available completion signal.
   * Prefers `job_activity` completion events with status/updated_at fallback.
   */
  completedToday: number;
  /** Jobs past scheduled_for that are not yet Completed or Cancelled. */
  jobsRunningLate: number;
  /**
   * Average estimated_duration_hours across dispatch plans with
   * dispatch_status='completed' for today.
   * Returns null when no plans are available (shown as "—" in the UI).
   * NOTE: uses estimated, not actual, duration (Sprint 8: add measured time).
   */
  avgCompletionHours: number | null;
}

// ------------------------------------------------------------------
// Problem Job
// A job that surfaces in the at-risk / problem jobs widget.
// ------------------------------------------------------------------

export type ProblemReason = "late" | "unassigned" | "on_hold";

export interface ProblemJob {
  job: Job;
  /** One or more reasons this job appears in the Problem Jobs widget. */
  reasons: ProblemReason[];
}

// ------------------------------------------------------------------
// Snapshot — the assembled result passed to CommandCenterScreen
// ------------------------------------------------------------------

export interface CommandCenterSnapshot {
  /** ISO date string for "today" as of query time (YYYY-MM-DD). */
  today: string;

  // --- Job queues ---
  scheduledToday: Job[];
  inProgress: Job[];
  /** Jobs with status = 'On Hold'. Label kept honest — not "waiting on parts". */
  onHold: Job[];
  /** Open inspection-type jobs. */
  inspections: Job[];
  /** Jobs matching callback pattern. */
  callbacks: Job[];
  /** Jobs with no assigned technician. */
  unassigned: Job[];
  /** Jobs past their scheduled date that are still open. */
  late: Job[];
  /** Jobs completed today. */
  completedToday: Job[];

  // --- Dispatch context (for permit KPI + avg completion time) ---
  dispatchPlans: DispatchPlan[];

  // --- Derived aggregations ---
  kpis: CommandCenterKPIs;
  personWorkload: WorkloadEntry[];
  teamWorkload: WorkloadEntry[];
  problemJobs: ProblemJob[];
}
