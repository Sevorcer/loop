/**
 * PR3C: Production clock-time scheduling utilities.
 *
 * These helpers bridge the gap between the legacy date+hour model and the new
 * timestamptz scheduling columns (scheduled_start_at, scheduled_end_at, etc.).
 *
 * Design rules:
 *  - All ISO timestamp strings are expected to be valid ISO 8601.
 *  - "datetime-local" strings (from <input type="datetime-local">) use the
 *    format "YYYY-MM-DDTHH:mm" — no timezone offset. They are interpreted in
 *    the company timezone (America/Los_Angeles by default), not the browser
 *    zone and not UTC.
 *  - Display and day grouping use that same company timezone.
 */

import { formatDateOnly } from "@/lib/dates";
import {
  companyCalendarDate,
  companyTimeZone,
  utcIsoToCompanyDateTimeLocal,
  zonedWallTimeToUtcIso,
} from "@/lib/timezone";

import type { Job, JobAppointmentHour } from "../types/job";
import {
  DEFAULT_JOB_APPOINTMENT_HOUR,
  formatJobAppointmentHour,
  readJobAppointmentHour,
} from "./appointmentWindow";

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats a stored ISO 8601 timestamp (or date-only string) for human display.
 * Uses the company timezone so server render and the browser agree.
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
    timeZone: companyTimeZone(),
  });
}

/**
 * F20: display helper for the job detail "Appointment Hour" block.
 * The new-job form saves an offset-aware `scheduled_start_at` but never sends
 * the legacy `appointmentHour`, so `readJobAppointmentHour` always falls back
 * to DEFAULT_JOB_APPOINTMENT_HOUR (9) — rendering "9:00 AM" no matter what
 * time was picked. Prefer the real scheduled time when present; fall back to
 * the legacy hour display only for jobs with no `scheduled_start_at`.
 */
export function formatJobAppointmentDisplay(
  job: Pick<Job, "scheduledStartAt" | "appointmentHour">,
): string {
  if (job.scheduledStartAt) {
    return formatScheduledTime(job.scheduledStartAt);
  }
  return formatJobAppointmentHour(readJobAppointmentHour(job));
}

/**
 * Formats an ISO timestamp as a short "date + time" label for table cells and
 * dispatch badges.
 * Falls back to a plain date string when there is no time component.
 *
 * Note: returns "—" (em dash) rather than an empty string because this function
 * is designed for inline display labels where an em dash signals "not set" more
 * clearly than a blank cell. `formatScheduledTime` returns "" because it is used
 * in longer-form contexts where the caller controls empty-state rendering.
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
    timeZone: companyTimeZone(),
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

  // An offset or Z means the caller already has an instant. Keep it.
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const instant = new Date(trimmed);
    if (Number.isNaN(instant.getTime())) return null;
    return instant.toISOString();
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) {
    const fallback = new Date(normalized);
    if (Number.isNaN(fallback.getTime())) return null;
    return fallback.toISOString();
  }

  // Wall-clock time is the company day, not the browser zone and not UTC.
  return zonedWallTimeToUtcIso({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  });
}

/**
 * Derives the legacy calendar-date (`scheduled_for`, "YYYY-MM-DD") from a
 * datetime-local wall-clock string ("YYYY-MM-DDTHH:mm").
 *
 * The date part is taken from the wall time the user picked — NOT from a
 * timezone-shifted instant — so the calendar/day views agree with the form.
 * Returns null when the value is missing or not a valid calendar date.
 */
export function deriveScheduledForDate(
  value: string | null | undefined,
): string | null {
  if (!value || typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const probe = new Date(y, m - 1, d);
  if (
    probe.getFullYear() !== y ||
    probe.getMonth() !== m - 1 ||
    probe.getDate() !== d
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
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
  return utcIsoToCompanyDateTimeLocal(isoValue);
}

/** Company-timezone calendar date for grouping a job onto a single day. */
export function scheduledCompanyDate(value: string | null | undefined): string | null {
  return companyCalendarDate(value);
}

/**
 * Human label for a scheduled window. A 2:00–5:00 PM Pacific job stays on one
 * day instead of spanning midnight UTC into the next calendar date.
 */
export function formatCompanyScheduleRange(
  startValue: string | null | undefined,
  endValue: string | null | undefined,
): string | null {
  const startDay = companyCalendarDate(startValue);
  const endDay = companyCalendarDate(endValue);
  if (!startDay || !endDay) return null;
  const startLabel = formatDateOnly(startDay);
  if (!startLabel) return null;
  if (startDay === endDay) return startLabel;
  const endLabel = formatDateOnly(endDay);
  if (!endLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
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
