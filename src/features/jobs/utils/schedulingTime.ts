/**
 * PR3C: Production clock-time scheduling utilities.
 *
 * These helpers bridge the gap between the legacy date+hour model and the new
 * timestamptz scheduling columns (scheduled_start_at, scheduled_end_at, etc.).
 *
 * Design rules:
 *  - All ISO timestamp strings are expected to be valid ISO 8601.
 *  - "datetime-local" strings (from <input type="datetime-local">) use the
 *    format "YYYY-MM-DDTHH:mm" — no timezone offset.
 *  - Display uses the browser's local timezone via toLocaleString.
 */

import type { JobAppointmentHour } from "../types/job";
import { DEFAULT_JOB_APPOINTMENT_HOUR } from "./appointmentWindow";

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats a stored ISO 8601 timestamp (or date-only string) for human display.
 * Uses the browser's local timezone when running in the browser; falls back to
 * UTC when running server-side (e.g. in tests).
 *
 * Returns an empty string if the value is null/undefined/empty.
 */
export function formatScheduledTime(
  isoValue: string | null | undefined,
): string {
  if (!isoValue) return "";

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";

  // Date-only strings ("YYYY-MM-DD") don't carry time info — just format as date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoValue)) {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Formats an ISO timestamp as a short "date + time" label for table cells.
 * Falls back to a plain date string when there is no time component.
 */
export function formatScheduledShort(
  isoValue: string | null | undefined,
): string {
  if (!isoValue) return "—";

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "—";

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoValue)) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Parsing datetime-local input values ─────────────────────────────────────

/**
 * Converts a datetime-local input value ("YYYY-MM-DDTHH:mm") to a full ISO
 * 8601 string with seconds ("YYYY-MM-DDTHH:mm:ss").  Returns null for empty /
 * invalid input rather than throwing, so callers can treat null as "not set".
 */
export function parseDatetimeLocalInput(
  value: string | null | undefined,
): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Normalize "YYYY-MM-DDTHH:mm" → "YYYY-MM-DDTHH:mm:00"
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed}:00`
    : trimmed;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;

  return normalized;
}

/**
 * Converts a stored ISO timestamp to the value needed for an
 * <input type="datetime-local"> element ("YYYY-MM-DDTHH:mm").
 * Returns an empty string when the value is null/undefined/invalid.
 */
export function toDatetimeLocalValue(
  isoValue: string | null | undefined,
): string {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

// ─── Legacy conversion ────────────────────────────────────────────────────────

/**
 * Derives a `scheduled_start_at`-compatible ISO string from the legacy
 * `scheduled_for` (date-only "YYYY-MM-DD") and `appointment_window` (hour 1-12).
 *
 * Backfill assumption: the date is treated as a UTC calendar date and the hour
 * is a UTC hour-of-day.  This mirrors the SQL backfill in migration
 * 20260729000003_pr3c_scheduled_timestamps.sql.
 *
 * Returns null when `scheduledFor` is empty / invalid.
 */
export function deriveScheduledStartAt(
  scheduledFor: string | null | undefined,
  appointmentHour: JobAppointmentHour | null | undefined = DEFAULT_JOB_APPOINTMENT_HOUR,
): string | null {
  if (!scheduledFor) return null;
  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.exec(scheduledFor.trim());
  if (!dateMatch) return null;

  const hour = appointmentHour ?? DEFAULT_JOB_APPOINTMENT_HOUR;
  const pad = (n: number) => String(n).padStart(2, "0");
  // Construct a UTC timestamp string: "YYYY-MM-DDTHH:00:00Z"
  return `${scheduledFor}T${pad(hour)}:00:00Z`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Returns true when the given time window is valid (start <= end, or either is
 * absent).  An empty/null/undefined value is treated as "absent" and is always
 * considered valid.
 */
export function isValidTimeWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (!start || !end) return true;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return false;
  return startTime <= endTime;
}

/**
 * Returns a human-readable error message for an invalid time window, or null
 * when the window is valid.
 */
export function getTimeWindowError(
  start: string | null | undefined,
  end: string | null | undefined,
  windowLabel = "end time",
): string | null {
  if (isValidTimeWindow(start, end)) return null;
  return `The ${windowLabel} must be at or after the start time.`;
}
