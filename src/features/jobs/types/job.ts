export type JobType = "Install" | "Service" | "Maintenance" | "Inspection" | "Estimate" | "Callback";

export type JobStatus =
  | "Scheduled"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Cancelled";

export type JobPriority = "Low" | "Medium" | "High";
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
  contractorIds?: string[];
}