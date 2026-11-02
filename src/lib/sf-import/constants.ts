/**
 * Owner decisions for the Service Fusion import.
 * Change these only when the company intentionally changes the window.
 * The command can override them for one run.
 */

/** Bring records dated on this day or later. */
export const SF_IMPORT_CUTOFF_DATE = "2024-11-01";

/**
 * Open jobs dated more than this many days before the import run stay in
 * Service Fusion, along with open jobs that have no date. Open jobs inside
 * this window, and future open jobs, are imported.
 */
export const SF_STALE_OPEN_DAYS = 60;

/** Legacy One Heating works in Pacific time. Service Fusion times are read in this zone. */
export const SF_IMPORT_TIME_ZONE = "America/Los_Angeles";

export const SF_JOB_NUMBER_PREFIX = "SF-";

export interface SfImportOptions {
  cutoffDate: string;
  /** Open jobs older than this many days before asOfDate are left behind. */
  staleOpenDays: number;
  /** The import run date, YYYY-MM-DD, in the company timezone. */
  asOfDate: string;
  timeZone: string;
  jobNumberPrefix: string;
}

/**
 * Work is finished or called off in Service Fusion.
 * The status named "Completed" is not in this list: in their books that still
 * means the work is done but not yet invoiced, so it counts as open.
 */
export const SF_CLOSED_STATUSES = new Set([
  "paid in full",
  "no charge",
  "warranty",
  "invoiced",
  "job cancelled",
  "job canceled",
  "cancelled",
  "canceled",
  "cancelled-write off",
  "canceled-write off",
  "estimate closed",
  "past due",
]);

export const LOOP_JOB_STATUSES = [
  "Scheduled",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
] as const;

export type LoopJobStatus = (typeof LOOP_JOB_STATUSES)[number];

export const LOOP_JOB_TYPES = [
  "Install",
  "Service",
  "Maintenance",
  "Inspection",
  "Estimate",
  "Callback",
] as const;

export type LoopJobType = (typeof LOOP_JOB_TYPES)[number];

export const LOOP_PRIORITIES = ["Low", "Medium", "High"] as const;

export type LoopPriority = (typeof LOOP_PRIORITIES)[number];
