import type { Job } from "../types/job";
import type { JobAppointmentHour } from "../types/job";

export const JOB_APPOINTMENT_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type { JobAppointmentHour };

export const DEFAULT_JOB_APPOINTMENT_HOUR: JobAppointmentHour = 9;

export function isValidJobAppointmentHour(value: unknown): value is JobAppointmentHour {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 12
  );
}

export function parseJobAppointmentHour(
  value: unknown,
  fallback: JobAppointmentHour = DEFAULT_JOB_APPOINTMENT_HOUR,
): JobAppointmentHour {
  if (value == null || value === "") {
    return fallback;
  }

  const num = typeof value === "number" ? value : Number(value);

  if (!isValidJobAppointmentHour(num)) {
    throw new Error("Invalid appointment hour.");
  }

  return num;
}

export function readJobAppointmentHour(job: Pick<Job, "appointmentHour">): JobAppointmentHour {
  return parseJobAppointmentHour(job.appointmentHour, DEFAULT_JOB_APPOINTMENT_HOUR);
}

/**
 * Formats a 1–12 appointment hour as a human-readable time string.
 * Hours 1–11 map to AM; hour 12 maps to 12 PM (noon).
 * The valid range is 1–12 with no AM/PM midnight representation (no 12 AM),
 * reflecting HVAC service scheduling windows that span standard business hours.
 */
export function formatJobAppointmentHour(hour: JobAppointmentHour): string {
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour}:00 ${suffix}`;
}

// ---------------------------------------------------------------------------
// Legacy aliases kept for backward compatibility during the Morning/Afternoon
// → hour migration. Callers should migrate to the hour-based names above.
// ---------------------------------------------------------------------------

/** @deprecated Use DEFAULT_JOB_APPOINTMENT_HOUR */
export const DEFAULT_JOB_APPOINTMENT_WINDOW = DEFAULT_JOB_APPOINTMENT_HOUR;

/** @deprecated Use isValidJobAppointmentHour */
export function isValidJobAppointmentWindow(value: unknown): boolean {
  return isValidJobAppointmentHour(value);
}

/** @deprecated Use parseJobAppointmentHour */
export function parseJobAppointmentWindow(
  value: unknown,
  fallback: JobAppointmentHour = DEFAULT_JOB_APPOINTMENT_HOUR,
): JobAppointmentHour {
  return parseJobAppointmentHour(value, fallback);
}

/** @deprecated Use readJobAppointmentHour */
export function readJobAppointmentWindow(job: Pick<Job, "appointmentHour">): JobAppointmentHour {
  return readJobAppointmentHour(job);
}

/** @deprecated Use JOB_APPOINTMENT_HOURS */
export const JOB_APPOINTMENT_WINDOWS = JOB_APPOINTMENT_HOURS;

