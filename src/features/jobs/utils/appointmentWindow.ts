import type { Job } from "../types/job";

export const JOB_APPOINTMENT_WINDOWS = ["Morning", "Afternoon"] as const;

export type JobAppointmentWindow = (typeof JOB_APPOINTMENT_WINDOWS)[number];

export const DEFAULT_JOB_APPOINTMENT_WINDOW: JobAppointmentWindow = "Morning";

export function isValidJobAppointmentWindow(value: unknown): value is JobAppointmentWindow {
  return typeof value === "string" && JOB_APPOINTMENT_WINDOWS.includes(value as JobAppointmentWindow);
}

export function parseJobAppointmentWindow(
  value: unknown,
  fallback: JobAppointmentWindow = DEFAULT_JOB_APPOINTMENT_WINDOW,
): JobAppointmentWindow {
  if (value == null || value === "") {
    return fallback;
  }

  if (!isValidJobAppointmentWindow(value)) {
    throw new Error("Invalid appointment window.");
  }

  return value;
}

export function readJobAppointmentWindow(job: Pick<Job, "appointmentWindow">): JobAppointmentWindow {
  return parseJobAppointmentWindow(job.appointmentWindow, DEFAULT_JOB_APPOINTMENT_WINDOW);
}
