/**
 * Calendar day grouping and labels.
 *
 * Jobs are placed on company-timezone calendar dates (NEXT_PUBLIC_COMPANY_TIME_ZONE,
 * default America/Los_Angeles), including across daylight-saving transitions.
 * A job with neither scheduledFor nor scheduledStartAt is unscheduled and is
 * left off the board (those stay in Daily Plans).
 *
 * Time off and standalone calendar tasks are separate records. They are placed
 * on the board by calendarEntries.ts. Checklist rows in job_tasks are not
 * appointments, and dispatch schedule blocks would duplicate the same jobs.
 */

import type { Job, JobAppointmentHour } from "@/features/jobs/types/job";
import {
  addCalendarDays,
  companyCalendarDate,
  companyTimeOfDay,
  zonedWallTimeToUtcIso,
} from "@/lib/timezone";

export const CALENDAR_VIEW_STORAGE_KEY = "loop.calendar.view";

export type CalendarViewMode = "month" | "week";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Safety stop so a bad end timestamp cannot build an unbounded day list. */
const MAX_SPAN_DAYS = 366;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function parseCalendarView(value: string | null | undefined): CalendarViewMode | null {
  if (value === "month" || value === "week") return value;
  return null;
}

/** A shared link wins. Otherwise the last choice saved in this browser. */
export function resolveCalendarView(input: {
  urlView?: string | null;
  storedView?: string | null;
}): CalendarViewMode {
  return parseCalendarView(input.urlView) ?? parseCalendarView(input.storedView) ?? "month";
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  const name = MONTH_NAMES[monthIndex] ?? "";
  return `${name} ${year}`.trim();
}

export function weekdayLabel(date: string): string {
  const utc = utcDate(date);
  if (!utc) return "";
  return WEEKDAYS_SHORT[utc.getUTCDay()] ?? "";
}

export function formatLongDate(date: string): string {
  const parts = dateParts(date);
  const utc = utcDate(date);
  if (!parts || !utc) return date;
  const weekday = WEEKDAYS_LONG[utc.getUTCDay()] ?? "";
  return `${weekday}, ${MONTH_ABBR[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

export function relativeDayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addCalendarDays(today, -1)) return "Yesterday";
  if (date === addCalendarDays(today, 1)) return "Tomorrow";
  const utc = utcDate(date);
  if (!utc) return "";
  return WEEKDAYS_LONG[utc.getUTCDay()] ?? "";
}

/** Sunday–Saturday week that contains `anchor` (YYYY-MM-DD). */
export function startOfWeek(date: string): string {
  const utc = utcDate(date);
  if (!utc) return date;
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay());
  return utc.toISOString().slice(0, 10);
}

export function weekDates(anchor: string): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index));
}

export function shiftDate(date: string, days: number): string {
  return addCalendarDays(date, days);
}

export function formatWeekRangeLabel(start: string, end: string): string {
  const a = dateParts(start);
  const b = dateParts(end);
  if (!a || !b) return `${start} – ${end}`;
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${MONTH_ABBR[a.month - 1]} ${a.day} – ${b.day}, ${b.year}`;
  }
  if (a.year === b.year) {
    return `${MONTH_ABBR[a.month - 1]} ${a.day} – ${MONTH_ABBR[b.month - 1]} ${b.day}, ${b.year}`;
  }
  return `${MONTH_ABBR[a.month - 1]} ${a.day}, ${a.year} – ${MONTH_ABBR[b.month - 1]} ${b.day}, ${b.year}`;
}

/**
 * Company dates a job occupies, inclusive. Empty when the job is unscheduled.
 * The clock-time start wins over the legacy date when both exist, so a UTC
 * instant that falls on the previous Pacific evening stays on that evening.
 */
export function jobCalendarDates(
  job: Pick<Job, "scheduledFor" | "scheduledStartAt" | "scheduledEndAt">,
): string[] {
  const start = scheduledStartDate(job);
  if (!start) return [];

  const endInstant = companyCalendarDate(job.scheduledEndAt);
  const end = endInstant && endInstant > start ? endInstant : start;
  if (end === start) return [start];

  const dates = [start];
  let cursor = start;
  for (let i = 0; i < MAX_SPAN_DAYS && cursor < end; i += 1) {
    const next = addCalendarDays(cursor, 1);
    if (next <= cursor) break;
    dates.push(next);
    cursor = next;
  }
  return dates;
}

export function isJobScheduled(
  job: Pick<Job, "scheduledFor" | "scheduledStartAt">,
): boolean {
  return scheduledStartDate(job) != null;
}

/** Every scheduled job for each company date, earliest start first. No cap. */
export function groupJobsByDate(jobs: readonly Job[]): Record<string, Job[]> {
  const grouped: Record<string, Job[]> = {};
  for (const job of jobs) {
    for (const date of jobCalendarDates(job)) {
      const list = grouped[date];
      if (list) list.push(job);
      else grouped[date] = [job];
    }
  }
  for (const date of Object.keys(grouped)) {
    grouped[date].sort(compareCalendarJobs);
  }
  return grouped;
}

export function compareCalendarJobs(a: Job, b: Job): number {
  const aMs = calendarStartMs(a);
  const bMs = calendarStartMs(b);
  if (aMs != null && bMs != null && aMs !== bMs) return aMs - bMs;
  if (aMs != null && bMs == null) return -1;
  if (aMs == null && bMs != null) return 1;
  const byHeading = calendarJobHeading(a).localeCompare(calendarJobHeading(b));
  if (byHeading !== 0) return byHeading;
  return a.id.localeCompare(b.id);
}

/** Milliseconds of the company start, or null when the job has no time. */
export function calendarStartMs(
  job: Pick<Job, "scheduledStartAt" | "scheduledFor" | "appointmentHour">,
): number | null {
  if (job.scheduledStartAt) {
    const ms = Date.parse(job.scheduledStartAt);
    if (!Number.isNaN(ms)) return ms;
  }
  return legacyAppointmentMs(job.scheduledFor, job.appointmentHour);
}

/** "08:30 am" in the company timezone. Null when the instant is missing or invalid. */
export function formatCompanyClock(iso: string | null | undefined): string | null {
  const hm = companyTimeOfDay(iso);
  if (!hm) return null;
  const [hourText, minuteText] = hm.split(":");
  const hour24 = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour24) || !Number.isInteger(minute)) return null;
  return formatClock(hour24, minute);
}

/**
 * Time line for a card sitting on `onDate`.
 * Single-day jobs show "08:30 am - 09:30 am".
 * Multi-day jobs say when they start, that they run all day, or when they end.
 */
export function formatCalendarTimeRange(
  job: Pick<Job, "scheduledFor" | "scheduledStartAt" | "scheduledEndAt" | "appointmentHour">,
  onDate?: string,
): string {
  const dates = jobCalendarDates(job);
  const startClock = formatCompanyClock(job.scheduledStartAt);
  const endClock = formatCompanyClock(job.scheduledEndAt);
  const startDay = dates[0];
  const endDay = dates[dates.length - 1];

  if (dates.length > 1 && onDate && startDay && endDay) {
    if (onDate === startDay) return startClock ? `Starts ${startClock}` : "Starts";
    if (onDate === endDay) return endClock ? `Ends ${endClock}` : "Ends";
    if (onDate > startDay && onDate < endDay) return "All day";
  }

  if (startClock && endClock) return `${startClock} - ${endClock}`;
  if (startClock) return startClock;
  if (job.appointmentHour) return formatLegacyHour(job.appointmentHour);
  return "Time not set";
}

export function calendarJobHeading(job: Pick<Job, "customerName" | "title">): string {
  const customer = job.customerName.trim();
  if (customer) return customer;
  const title = job.title.trim();
  return title || "Untitled job";
}

/** Job title when it adds something the customer name does not already say. */
export function calendarJobSubtitle(job: Pick<Job, "customerName" | "title">): string | null {
  const customer = job.customerName.trim();
  const title = job.title.trim();
  if (!customer || !title || title.toLowerCase() === customer.toLowerCase()) return null;
  return title;
}

/** Assignee names when present, otherwise the legacy assigned-to text. */
export function calendarTechnicianNames(
  job: Pick<Job, "assignees" | "assignedTo">,
): string[] {
  const fromAssignees = (job.assignees ?? [])
    .map((assignee) => assignee.name.trim())
    .filter((name) => name.length > 0);
  if (fromAssignees.length > 0) return fromAssignees;
  return (job.assignedTo ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((name) => name.length > 0);
}

export function calendarTechLabel(job: Pick<Job, "assignees" | "assignedTo">): string {
  const names = calendarTechnicianNames(job);
  if (names.length === 0) return "Techs: Unassigned";
  return `Techs: ${names.join(", ")}`;
}

export function isCalendarJobUnassigned(job: Pick<Job, "assignees" | "assignedTo">): boolean {
  return calendarTechnicianNames(job).length === 0;
}

function scheduledStartDate(
  job: Pick<Job, "scheduledFor" | "scheduledStartAt">,
): string | null {
  const fromClock = companyCalendarDate(job.scheduledStartAt);
  if (fromClock) return fromClock;
  const legacy = job.scheduledFor?.slice(0, 10) ?? "";
  return DATE_ONLY.test(legacy) ? legacy : null;
}

function legacyAppointmentMs(
  scheduledFor: string | null | undefined,
  hour: JobAppointmentHour | null | undefined,
): number | null {
  if (!scheduledFor || !hour) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(scheduledFor.trim());
  if (!match) return null;
  const iso = zonedWallTimeToUtcIso({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour,
    minute: 0,
  });
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function formatLegacyHour(hour: JobAppointmentHour): string {
  // Hours 1–11 are morning. Hour 12 is noon. Matches formatJobAppointmentHour.
  const suffix = hour < 12 ? "am" : "pm";
  return `${String(hour).padStart(2, "0")}:00 ${suffix}`;
}

function formatClock(hour24: number, minute: number): string {
  const suffix = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function utcDate(date: string): Date | null {
  const parts = dateParts(date);
  if (!parts) return null;
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    utc.getUTCFullYear() !== parts.year ||
    utc.getUTCMonth() !== parts.month - 1 ||
    utc.getUTCDate() !== parts.day
  ) {
    return null;
  }
  return utc;
}

function dateParts(date: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}
