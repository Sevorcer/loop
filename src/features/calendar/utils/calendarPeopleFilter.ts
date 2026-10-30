import type { Job } from "@/features/jobs/types/job";
import { formatTeamLabel } from "@/lib/teamLabel";

import type { CalendarPerson, CalendarTaskEntry, TimeOffEntry } from "../types/calendarEntries";
import { calendarTechnicianNames } from "./calendarSchedule";

export const CALENDAR_PEOPLE_STORAGE_KEY = "loop.calendar.people";
export const CALENDAR_PEOPLE_GROUPS_KEY = "loop.calendar.people.groups";

export interface CalendarQuickGroup {
  id: string;
  name: string;
  personIds: string[];
}

export function parseStoredPersonIds(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
  } catch {
    return [];
  }
}

export function parseStoredQuickGroups(value: string | null | undefined): CalendarQuickGroup[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const groups: CalendarQuickGroup[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.trim() : "";
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const personIds = Array.isArray(record.personIds)
        ? record.personIds.filter((personId): personId is string => typeof personId === "string" && personId.trim().length > 0)
        : [];
      if (!id || !name || personIds.length === 0) continue;
      groups.push({ id, name, personIds: [...new Set(personIds)] });
    }
    return groups;
  } catch {
    return [];
  }
}

export function quickGroupName(people: readonly CalendarPerson[], personIds: readonly string[]): string {
  const names = personIds
    .map((id) => people.find((person) => person.id === id)?.name ?? "")
    .filter((name) => name.length > 0);
  return formatTeamLabel(names) || "Group";
}

function jobMatchesPeople(
  job: Job,
  selected: ReadonlySet<string>,
  people: readonly CalendarPerson[],
): boolean {
  if (selected.size === 0) return true;
  const assigneeIds = (job.assignees ?? []).map((assignee) => assignee.id).filter(Boolean);
  if (assigneeIds.some((id) => selected.has(id))) return true;
  if (assigneeIds.length > 0) return false;
  const names = new Set(calendarTechnicianNames(job).map((name) => name.toLowerCase()));
  return people.some(
    (person) => selected.has(person.id) && names.has(person.name.trim().toLowerCase()),
  );
}

export function filterCalendarByPeople<TJob extends Job>(input: {
  jobs: readonly TJob[];
  timeOff: readonly TimeOffEntry[];
  tasks: readonly CalendarTaskEntry[];
  selectedIds: readonly string[];
  people: readonly CalendarPerson[];
}): { jobs: TJob[]; timeOff: TimeOffEntry[]; tasks: CalendarTaskEntry[] } {
  const selected = new Set(input.selectedIds);
  if (selected.size === 0) {
    return {
      jobs: [...input.jobs],
      timeOff: [...input.timeOff],
      tasks: [...input.tasks],
    };
  }
  return {
    jobs: input.jobs.filter((job) => jobMatchesPeople(job, selected, input.people)),
    timeOff: input.timeOff.filter((entry) => selected.has(entry.userId)),
    tasks: input.tasks.filter(
      (task) => task.assignEveryone || task.assigneeIds.some((id) => selected.has(id)),
    ),
  };
}

export function calendarPeopleFilterLabel(
  people: readonly CalendarPerson[],
  selectedIds: readonly string[],
): string {
  if (selectedIds.length === 0) return "All";
  return quickGroupName(people, selectedIds);
}
