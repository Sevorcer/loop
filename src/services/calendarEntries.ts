import "server-only";

import { allDayBounds } from "@/features/calendar/utils/calendarEntries";
import { canManageCalendarEntries } from "@/features/calendar/types/calendarEntries";
import type { CalendarPerson, CalendarTaskEntry, TimeOffEntry } from "@/features/calendar/types/calendarEntries";
import { parseDatetimeLocalInput } from "@/features/jobs/utils/schedulingTime";
import type { AppRole } from "@/services/authorization";
import {
  deleteCalendarTask,
  deleteTimeOff,
  findCustomerIdByName,
  findJobIdByNumber,
  insertCalendarTask,
  insertTimeOff,
  listCalendarTasks,
  listCalendarTeam,
  listTimeOff,
  setCalendarTaskDone,
  updateCalendarTask,
  updateTimeOff,
} from "@/repositories/calendarEntries";

export async function listCalendarSchedule(): Promise<{
  timeOff: TimeOffEntry[];
  tasks: CalendarTaskEntry[];
}> {
  const [timeOff, tasks] = await Promise.all([listTimeOff(), listCalendarTasks()]);
  return { timeOff, tasks };
}

export async function listTeamForCalendar(): Promise<CalendarPerson[]> {
  return listCalendarTeam();
}

export async function saveTimeOff(
  role: AppRole,
  input: {
    id?: string;
    userId: string;
    allDay: boolean;
    start: string;
    end: string;
    reason: string;
    note?: string;
  },
): Promise<void> {
  requireOffice(role);
  const userId = input.userId.trim();
  const reason = input.reason.trim();
  if (!userId) throw new Error("A person is required.");
  if (!reason) throw new Error("A reason is required.");
  const range = toRange(input.allDay, input.start, input.end);
  const record = {
    userId,
    ...range,
    allDay: input.allDay,
    reason,
    note: input.note?.trim() ?? "",
  };
  if (input.id) await updateTimeOff(input.id, record);
  else await insertTimeOff(record);
}

export async function removeTimeOff(role: AppRole, id: string): Promise<void> {
  requireOffice(role);
  await deleteTimeOff(id);
}

export async function saveCalendarTask(
  role: AppRole,
  input: {
    id?: string;
    title: string;
    description?: string;
    allDay: boolean;
    start: string;
    end: string;
    assignEveryone: boolean;
    assigneeIds?: string[];
    jobNumber?: string;
    customerName?: string;
    done?: boolean;
  },
): Promise<void> {
  requireOffice(role);
  const title = input.title.trim();
  if (!title) throw new Error("A title is required.");
  const assigneeIds = Array.from(new Set((input.assigneeIds ?? []).map((id) => id.trim()).filter(Boolean)));
  if (!input.assignEveryone && assigneeIds.length === 0) {
    throw new Error("Assign the task to someone, or to everyone.");
  }
  const range = toRange(input.allDay, input.start, input.end);
  const links = await resolveLinks(input.jobNumber, input.customerName);
  const record = {
    title,
    description: input.description?.trim() ?? "",
    ...range,
    allDay: input.allDay,
    assignEveryone: input.assignEveryone,
    assigneeIds: input.assignEveryone ? [] : assigneeIds,
    jobId: links.jobId,
    customerId: links.customerId,
    doneAt: input.done ? new Date().toISOString() : null,
  };
  if (input.id) await updateCalendarTask(input.id, record);
  else await insertCalendarTask(record);
}

export async function markCalendarTaskDone(role: AppRole, id: string, done: boolean): Promise<void> {
  if (role !== "tech" && !canManageCalendarEntries(role)) {
    throw Object.assign(new Error("You cannot change this task."), { status: 403 });
  }
  await setCalendarTaskDone(id, done);
}

export async function removeCalendarTask(role: AppRole, id: string): Promise<void> {
  requireOffice(role);
  await deleteCalendarTask(id);
}

function requireOffice(role: AppRole): void {
  if (!canManageCalendarEntries(role)) {
    throw Object.assign(new Error("You cannot change the calendar."), { status: 403 });
  }
}

function toRange(allDay: boolean, start: string, end: string): { startsAt: string; endsAt: string } {
  if (allDay) {
    const bounds = allDayBounds(start.slice(0, 10), (end || start).slice(0, 10));
    if (!bounds) throw new Error("Invalid date range.");
    return bounds;
  }
  const startsAt = parseDatetimeLocalInput(start);
  const endsAt = parseDatetimeLocalInput(end);
  if (!startsAt || !endsAt) throw new Error("A start and end time are required.");
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error("Invalid time range. The end must be after the start.");
  }
  return { startsAt, endsAt };
}

async function resolveLinks(
  jobNumber: string | undefined,
  customerName: string | undefined,
): Promise<{ jobId: string | null; customerId: string | null }> {
  const number = jobNumber?.trim() ?? "";
  const name = customerName?.trim() ?? "";
  let jobId: string | null = null;
  let customerId: string | null = null;
  if (number) {
    jobId = await findJobIdByNumber(number);
    if (!jobId) throw new Error("That job number was not found.");
  }
  if (name) {
    customerId = await findCustomerIdByName(name);
    if (!customerId) throw new Error("That customer was not found.");
  }
  return { jobId, customerId };
}
