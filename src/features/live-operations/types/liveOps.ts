// ============================================================
// Live Operations — real-data types (rebuilt 2026-11-05)
//
// Live is the "right now" view inside Operations. Everything here is derived
// from real tables: jobs, job_assignees, job_activity, job_notes, time_off,
// user_profiles (and daily_plan_activations for the optional "day started"
// label). No mock data, no migrations.
// ============================================================

import type { Job, JobStatus } from "@/features/jobs/types/job";

/** Collin's ruling (2026-11-05): late-to-start and running-long fire at 60 minutes. */
export const LIVE_OPS_THRESHOLD_MINUTES = 60;

// ------------------------------------------------------------------
// Inputs (what the repository hands the pure derivation)
// ------------------------------------------------------------------

export interface LivePerson {
  id: string;
  name: string;
  role: string | null;
}

export interface LiveJob {
  id: string;
  jobNumber: string;
  title: string;
  type: string;
  status: JobStatus;
  customerName: string;
  propertyName: string;
  /** Company calendar date (YYYY-MM-DD) the job is scheduled for. */
  scheduledFor: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  arrivalWindowStartAt: string | null;
  arrivalWindowEndAt: string | null;
  /** First "On The Way" tap (per job, not per tech). */
  enRouteAt: string | null;
  assignees: { id: string; name: string }[];
  /** Full row for the reused job-list widgets. */
  job: Job;
}

export interface LiveActivity {
  id: string;
  jobId: string;
  type: string;
  title: string;
  createdAt: string;
  actorId: string | null;
}

export interface LiveNote {
  id: string;
  jobId: string;
  createdAt: string;
  authorId: string | null;
}

export interface LiveTimeOff {
  userId: string;
  startsAt: string;
  endsAt: string;
}

export interface LiveOpsInput {
  /** Company calendar date (YYYY-MM-DD). */
  date: string;
  /** "Now" as an ISO instant — injected so derivation is testable. */
  now: string;
  /** Today's (non-cancelled) jobs plus any In Progress job from any date. */
  jobs: LiveJob[];
  /** Activity rows for those jobs: today's, plus "Job started" rows of open In Progress jobs. */
  activity: LiveActivity[];
  /** Job notes created today on those jobs (bodies are never loaded). */
  notes: LiveNote[];
  /** Time off overlapping today. */
  timeOff: LiveTimeOff[];
  /** Internal team (owner/manager/dispatch/tech/office/sales). */
  people: LivePerson[];
  /** daily_plan_activations.started_at for today, when the day was activated. */
  dayStartedAt: string | null;
}

// ------------------------------------------------------------------
// Derived views
// ------------------------------------------------------------------

export type LiveJobStage =
  | "scheduled"
  | "on_the_way"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "cancelled";

export type AttentionKind =
  | "late_start"
  | "running_long"
  | "stuck_in_progress"
  | "double_booked"
  | "assigned_on_time_off"
  | "unassigned"
  | "on_hold";

export type AttentionSeverity = "warning" | "critical";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  jobId: string;
  jobNumber: string;
  personId: string | null;
  personName: string | null;
  /** Short plain-language headline, e.g. "Late to start". */
  title: string;
  /** One-line detail, e.g. "75 min past the 8:00 AM start, nobody on the way". */
  detail: string;
  /** Minutes late / over / since — when meaningful. */
  minutes: number | null;
}

export type TechState =
  | "off_today"
  | "on_job"
  | "on_the_way"
  | "between_jobs"
  | "not_started"
  | "done"
  | "free";

export interface TechJobRef {
  id: string;
  jobNumber: string;
  customerName: string;
  /** Start time for a next job; "started at" for a current job when known. */
  at: string | null;
}

export interface TechCard {
  personId: string;
  name: string;
  state: TechState;
  currentJob: TechJobRef | null;
  nextJob: TechJobRef | null;
  jobsToday: number;
  jobsDone: number;
  onTimeOff: boolean;
  attentionKinds: AttentionKind[];
}

export interface DayProgress {
  total: number;
  scheduled: number;
  onTheWay: number;
  inProgress: number;
  completed: number;
  onHold: number;
}

export interface FeedItem {
  id: string;
  at: string;
  jobId: string;
  jobNumber: string;
  /** Plain label, e.g. "Job started", "Photo or file added". */
  label: string;
  actorName: string | null;
}

export type HealthState = "healthy" | "minor_issues" | "needs_attention" | "critical";

export interface LiveOpsHero {
  techsWorking: number;
  techsOnTheWay: number;
  jobsRunning: number;
  lateOrLong: number;
  attentionCount: number;
  criticalCount: number;
  health: HealthState;
  healthLabel: string;
  lastActivityAt: string | null;
}

export interface LiveOpsSnapshot {
  date: string;
  generatedAt: string;
  dayStartedAt: string | null;
  thresholdMinutes: number;
  hero: LiveOpsHero;
  techs: TechCard[];
  attention: AttentionItem[];
  progress: DayProgress;
  feed: FeedItem[];
  /** Moved from Overview (2026-11-05): today's jobs, start-time order. */
  todayJobs: Job[];
  /** Moved from Overview (2026-11-05): every open In Progress job, any date. */
  inProgressJobs: Job[];
}
