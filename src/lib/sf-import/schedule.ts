import { addCalendarDays, zonedWallTimeToUtcIso } from "../timezone";

import { asBoolean, asNumber, asString, dateOnly } from "./json";

export function clockFrom(value: unknown): { hour: number; minute: number } | null {
  const text = asString(value);
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/.exec(text);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[4]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function wallClockIso(
  date: string,
  hour: number,
  minute: number,
  timeZone: string,
): string | null {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  return zonedWallTimeToUtcIso({ year, month, day, hour, minute, timeZone });
}

export function addSeconds(iso: string, seconds: number): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

export function timestampOrNull(value: unknown): string | null {
  const text = asString(value);
  if (!text || text.startsWith("1970-01-01")) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export interface JobSchedule {
  scheduled_for: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  arrival_window_start_at: string | null;
  arrival_window_end_at: string | null;
}

/** Clock times are Service Fusion's promised window, read in the company timezone. */
export function scheduleJob(job: Record<string, unknown>, timeZone: string): JobSchedule {
  const scheduledFor = dateOnly(job.start_date);
  const startClock = clockFrom(job.time_frame_promised_start);
  const endClock = clockFrom(job.time_frame_promised_end);
  const duration = asNumber(job.duration);

  const scheduledStart = scheduledFor && startClock
    ? wallClockIso(scheduledFor, startClock.hour, startClock.minute, timeZone)
    : null;
  let scheduledEnd = scheduledFor && endClock
    ? wallClockIso(scheduledFor, endClock.hour, endClock.minute, timeZone)
    : null;
  const arrivalStart = scheduledStart;
  let arrivalEnd = scheduledEnd;

  if (scheduledStart && !scheduledEnd && duration != null && duration > 0) {
    scheduledEnd = addSeconds(scheduledStart, duration);
  }
  if (scheduledStart && scheduledEnd && scheduledEnd < scheduledStart) {
    scheduledEnd = null;
    arrivalEnd = null;
  }

  return {
    scheduled_for: scheduledFor,
    scheduled_start_at: scheduledStart,
    scheduled_end_at: scheduledEnd,
    arrival_window_start_at: arrivalStart,
    arrival_window_end_at: arrivalEnd,
  };
}

export interface TaskWindow {
  starts_at: string;
  ends_at: string;
  all_day: boolean;
}

/**
 * Calendar rows need an end strictly after the start.
 * A task with no clock time covers the whole company-timezone day.
 */
export function scheduleTask(task: Record<string, unknown>, timeZone: string): TaskWindow | null {
  const startDate = dateOnly(task.start_date);
  if (!startDate) return null;
  const endDate = dateOnly(task.end_date);
  const startClock = clockFrom(task.start_time);
  const endClock = clockFrom(task.end_time);
  const allDay = asBoolean(task.is_no_specific_start_time) || !startClock;

  let starts: string | null;
  let ends: string | null;
  if (allDay || !startClock) {
    starts = wallClockIso(startDate, 0, 0, timeZone);
    const endDay = endDate && endDate > startDate ? endDate : addCalendarDays(startDate, 1);
    ends = wallClockIso(endDay, 0, 0, timeZone);
  } else {
    starts = wallClockIso(startDate, startClock.hour, startClock.minute, timeZone);
    const endDay = endDate ?? startDate;
    ends = endClock ? wallClockIso(endDay, endClock.hour, endClock.minute, timeZone) : null;
    if (starts && !ends) ends = addSeconds(starts, 60 * 60);
  }

  if (!starts || !ends) return null;
  if (ends <= starts) {
    const bumped = addSeconds(starts, 60);
    if (!bumped) return null;
    ends = bumped;
  }
  return { starts_at: starts, ends_at: ends, all_day: allDay };
}
