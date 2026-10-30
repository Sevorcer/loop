/**
 * Placement and labels for time off and standalone calendar tasks.
 * Dates use the company timezone, the same way jobs do.
 */

import type { Job } from "@/features/jobs/types/job";
import {
  addCalendarDays,
  companyCalendarDate,
  zonedWallTimeToUtcIso,
} from "@/lib/timezone";

import type { CalendarTaskEntry, TimeOffEntry } from "../types/calendarEntries";
import { calendarStartMs, formatCompanyClock, jobCalendarDates } from "./calendarSchedule";

const MAX_SPAN_DAYS = 366;

export interface CalendarBoardItem {
  kind: "job" | "time_off" | "task";
  id: string;
  sortMs: number;
  job?: Job;
  timeOff?: TimeOffEntry;
  task?: CalendarTaskEntry;
}

export function entryCalendarDates(entry: {
  startsAt: string;
  endsAt: string;
}): string[] {
  const start = companyCalendarDate(entry.startsAt);
  const endInstant = companyCalendarDate(entry.endsAt);
  if (!start) return [];
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

export function formatEntryTime(
  entry: { startsAt: string; endsAt: string; allDay: boolean },
  onDate?: string,
): string {
  if (entry.allDay) return "All day";
  const dates = entryCalendarDates(entry);
  if (dates.length > 1 && onDate) {
    const startClock = formatCompanyClock(entry.startsAt);
    const endClock = formatCompanyClock(entry.endsAt);
    if (onDate === dates[0]) return startClock ? `Starts ${startClock}` : "Starts";
    if (onDate === dates[dates.length - 1]) return endClock ? `Ends ${endClock}` : "Ends";
    if (onDate > dates[0] && onDate < dates[dates.length - 1]) return "All day";
  }
  const startClock = formatCompanyClock(entry.startsAt);
  const endClock = formatCompanyClock(entry.endsAt);
  if (startClock && endClock) return `${startClock} - ${endClock}`;
  return startClock ?? "Time not set";
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aStartMs = Date.parse(aStart);
  const aEndMs = Date.parse(aEnd);
  const bStartMs = Date.parse(bStart);
  const bEndMs = Date.parse(bEnd);
  if ([aStartMs, aEndMs, bStartMs, bEndMs].some((value) => Number.isNaN(value))) return false;
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/** Time off that covers any of these people during the appointment window. */
export function timeOffCovering(
  entries: readonly TimeOffEntry[],
  userIds: readonly string[],
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): TimeOffEntry[] {
  if (!startIso || userIds.length === 0) return [];
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return [];
  const end = endIso && !Number.isNaN(Date.parse(endIso))
    ? endIso
    : new Date(startMs + 60 * 60 * 1000).toISOString();
  const wanted = new Set(userIds);
  return entries.filter(
    (entry) => wanted.has(entry.userId) && rangesOverlap(entry.startsAt, entry.endsAt, startIso, end),
  );
}

export function taskAssigneeLabel(task: Pick<CalendarTaskEntry, "assignEveryone" | "assigneeNames">): string {
  if (task.assignEveryone) return "Assigned To: Everyone";
  if (task.assigneeNames.length === 0) return "Assigned To: Unassigned";
  return `Assigned To: ${task.assigneeNames.join(", ")}`;
}

export function allDayBounds(startDate: string, endDate: string): { startsAt: string; endsAt: string } | null {
  const start = dateParts(startDate);
  const end = dateParts(endDate);
  if (!start || !end) return null;
  if (endDate < startDate) return null;
  const startsAt = zonedWallTimeToUtcIso({ ...start, hour: 0, minute: 0, second: 0 });
  const endsAt = zonedWallTimeToUtcIso({ ...end, hour: 23, minute: 59, second: 0 });
  if (!startsAt || !endsAt) return null;
  return { startsAt, endsAt };
}

export function groupCalendarBoard(input: {
  jobs: readonly Job[];
  timeOff: readonly TimeOffEntry[];
  tasks: readonly CalendarTaskEntry[];
}): Record<string, CalendarBoardItem[]> {
  const grouped: Record<string, CalendarBoardItem[]> = {};

  const push = (date: string, item: CalendarBoardItem) => {
    const list = grouped[date];
    if (list) list.push(item);
    else grouped[date] = [item];
  };

  for (const job of input.jobs) {
    const sortMs = calendarStartMs(job) ?? Number.POSITIVE_INFINITY;
    for (const date of jobCalendarDates(job)) {
      push(date, { kind: "job", id: job.id, sortMs, job });
    }
  }
  for (const entry of input.timeOff) {
    const sortMs = Date.parse(entry.startsAt);
    for (const date of entryCalendarDates(entry)) {
      push(date, {
        kind: "time_off",
        id: entry.id,
        sortMs: Number.isNaN(sortMs) ? Number.POSITIVE_INFINITY : sortMs,
        timeOff: entry,
      });
    }
  }
  for (const entry of input.tasks) {
    const sortMs = Date.parse(entry.startsAt);
    for (const date of entryCalendarDates(entry)) {
      push(date, {
        kind: "task",
        id: entry.id,
        sortMs: Number.isNaN(sortMs) ? Number.POSITIVE_INFINITY : sortMs,
        task: entry,
      });
    }
  }

  for (const date of Object.keys(grouped)) {
    grouped[date].sort((a, b) => {
      if (a.sortMs !== b.sortMs) return a.sortMs - b.sortMs;
      const kindOrder = kindRank(a.kind) - kindRank(b.kind);
      if (kindOrder !== 0) return kindOrder;
      return itemLabel(a).localeCompare(itemLabel(b));
    });
  }
  return grouped;
}

function kindRank(kind: CalendarBoardItem["kind"]): number {
  if (kind === "time_off") return 0;
  if (kind === "task") return 1;
  return 2;
}

function itemLabel(item: CalendarBoardItem): string {
  if (item.kind === "time_off") return item.timeOff?.personName ?? item.id;
  if (item.kind === "task") return item.task?.title ?? item.id;
  return item.job ? compareLabel(item.job) : item.id;
}

function compareLabel(job: Job): string {
  return job.customerName.trim() || job.title.trim() || job.id;
}

function dateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}
