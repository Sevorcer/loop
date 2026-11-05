export type JobType = "Install" | "Service" | "Maintenance" | "Inspection" | "Estimate" | "Callback";

export type JobStatus =
  | "Scheduled"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Cancelled";

export type JobPriority = "Low" | "Medium" | "High";

/**
 * How a job closes out, picked by the office per job.
 * - "full": completion requires a tech photo, an installed system linked to
 *   the job, a job note, and the required QA items.
 * - "visit": completion requires a job note only (single-visit jobs such as
 *   inspection finals, where the install gates do not fit).
 */
export type JobCloseoutMode = "full" | "visit";
export type JobAppointmentHour = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface Job {
  id: string;
  jobNumber: string;
  estimateId?: string;
  equipmentBundleId?: string;
  title: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  customerId?: string | null;
  customerName: string;
  propertyId?: string | null;
  propertyName: string;
  assignedTo: string;

  // ── Real clock-time scheduling (PR3C) ────────────────────────────────────
  // Primary source of truth for all scheduling after migration 20260729000003.
  /** ISO 8601 timestamptz — committed job start time. */
  scheduledStartAt?: string | null;
  /** ISO 8601 timestamptz — committed job end time (optional). */
  scheduledEndAt?: string | null;
  /** ISO 8601 timestamptz — start of the customer-facing arrival window (optional). */
  arrivalWindowStartAt?: string | null;
  /** ISO 8601 timestamptz — end of the customer-facing arrival window (optional). */
  arrivalWindowEndAt?: string | null;

  // ── Legacy scheduling fields (deprecated — kept for one release window) ──
  // TODO(cleanup): Remove scheduledFor and appointmentHour once all callers
  // have migrated to scheduledStartAt. Migration 20260729000003_pr3c_scheduled_timestamps.sql
  // backfills scheduledStartAt from these values.
  /** @deprecated Use scheduledStartAt. Date-only ISO string "YYYY-MM-DD", or null when unscheduled. */
  scheduledFor: string | null;
  /** @deprecated Use scheduledStartAt. Hour-of-day 1–12. */
  appointmentHour?: JobAppointmentHour;

  summary: string;
  location: string;
  notes: string;
  // Closeout mode (migration 20261102000000) — absent when the column has
  // not been applied yet; readers treat anything but "visit" as "full".
      closeoutMode?: JobCloseoutMode;
    // Customer notifications (migration 20261120900000) — opt-in per job,
    // default off; enRouteAt is stamped on the first "On The Way" tap.
    customerNotificationsEnabled?: boolean;
    enRouteAt?: string | null;
  
  contractorIds?: string[];   assignees?: { id: string; name: string }[];
  /** People on the job when it was first marked completed. */
  completionTeam?: { id: string | null; name: string }[];
}
