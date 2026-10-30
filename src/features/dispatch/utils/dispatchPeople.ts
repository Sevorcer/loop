import { companyCalendarDate } from "@/lib/timezone";
import { formatTeamLabel, splitTeamNames } from "@/lib/teamLabel";

import type {
  Crew,
  CrewAssignment,
  DispatchAssignee,
  DispatchPerson,
  DispatchTimeOffWindow,
} from "../types/dispatch";

const PERSON_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OFFICE_ROLES = new Set(["owner", "manager", "dispatch", "office"]);

export function isDispatchPersonId(value: string): boolean {
  return PERSON_ID.test(value);
}

export function canAssignDispatchPeople(role: string | null | undefined): boolean {
  return typeof role === "string" && OFFICE_ROLES.has(role);
}

export function legacyPersonId(name: string): string {
  return `legacy:${encodeURIComponent(name.trim().toLowerCase())}`;
}

export function isLegacyAssignee(person: Pick<DispatchAssignee, "id" | "legacy">): boolean {
  return person.legacy === true || person.id.startsWith("legacy:");
}

function addPerson(people: DispatchAssignee[], next: DispatchAssignee): DispatchAssignee[] {
  const name = next.name.trim();
  if (!name) return people;
  const key = name.toLowerCase();
  if (people.some((person) => person.name.trim().toLowerCase() === key)) {
    return people.map((person) =>
      person.name.trim().toLowerCase() === key && isLegacyAssignee(person) && !isLegacyAssignee(next)
        ? { id: next.id, name, legacy: false }
        : person,
    );
  }
  return [...people, { id: next.id, name, legacy: next.legacy }];
}

function namesFromCrew(assignment?: CrewAssignment | null, crew?: Crew | null): string[] {
  const names: string[] = [];
  if (assignment?.leadInstaller) names.push(assignment.leadInstaller);
  if (assignment?.supportingTechnicians) names.push(...assignment.supportingTechnicians);
  if (crew?.leadInstaller) names.push(crew.leadInstaller);
  if (crew?.members) names.push(...crew.members.map((member) => member.name));
  return names;
}

/**
 * People on a dispatch card. Real job assignees come first. Names that only
 * exist on the old crew row stay visible so a scheduled job is not emptied
 * when a crew member has no user account.
 */
export function resolvePlanPeople(input: {
  jobAssignees?: readonly { id: string; name: string }[] | null;
  assignedTo?: string | null;
  assignment?: CrewAssignment | null;
  crew?: Crew | null;
}): DispatchAssignee[] {
  let people: DispatchAssignee[] = [];
  for (const assignee of input.jobAssignees ?? []) {
    if (!assignee.id || !assignee.name.trim()) continue;
    people = addPerson(people, { id: assignee.id, name: assignee.name });
  }
  for (const name of namesFromCrew(input.assignment, input.crew)) {
    people = addPerson(people, { id: legacyPersonId(name), name, legacy: true });
  }
  if (people.length === 0 && input.assignedTo?.trim()) {
    const raw = input.assignedTo.trim();
    const crewName = input.assignment?.crewName?.trim().toLowerCase();
    if (!crewName || raw.toLowerCase() !== crewName) {
      for (const name of splitTeamNames(raw)) {
        people = addPerson(people, { id: legacyPersonId(name), name, legacy: true });
      }
    }
  }
  return people;
}

export function persistedAssigneeIds(people: readonly DispatchAssignee[]): string[] {
  const ids: string[] = [];
  for (const person of people) {
    if (isLegacyAssignee(person) || !isDispatchPersonId(person.id)) continue;
    if (!ids.includes(person.id)) ids.push(person.id);
  }
  return ids;
}

export function teamLabelForPeople(people: readonly { name: string }[]): string {
  return formatTeamLabel(people.map((person) => person.name));
}

export function addDispatchPerson(
  people: readonly DispatchAssignee[],
  person: DispatchPerson,
): DispatchAssignee[] {
  return addPerson([...people], { id: person.id, name: person.name });
}

export function removeDispatchPerson(
  people: readonly DispatchAssignee[],
  personId: string,
): DispatchAssignee[] {
  return people.filter((person) => person.id !== personId);
}

export function replaceDispatchPerson(
  people: readonly DispatchAssignee[],
  personId: string,
  next: DispatchPerson,
): DispatchAssignee[] {
  const without = people.filter((person) => person.id !== personId && person.id !== next.id);
  const removed = people.find((person) => person.id === personId);
  if (!removed) return [...people];
  const index = people.findIndex((person) => person.id === personId);
  const replaced = [...without];
  replaced.splice(Math.min(index, replaced.length), 0, { id: next.id, name: next.name });
  return replaced;
}

export function moveDispatchPerson(
  source: readonly DispatchAssignee[],
  target: readonly DispatchAssignee[],
  personId: string,
): { source: DispatchAssignee[]; target: DispatchAssignee[] } | null {
  const person = source.find((item) => item.id === personId);
  if (!person || isLegacyAssignee(person)) return null;
  return {
    source: source.filter((item) => item.id !== personId),
    target: addPerson([...target], { id: person.id, name: person.name }),
  };
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const aStart = Date.parse(startA);
  const aEnd = Date.parse(endA);
  const bStart = Date.parse(startB);
  const bEnd = Date.parse(endB);
  if ([aStart, aEnd, bStart, bEnd].some((value) => Number.isNaN(value))) return false;
  return aStart < bEnd && bStart < aEnd;
}

function coversDate(entry: DispatchTimeOffWindow, date: string): boolean {
  const start = companyCalendarDate(entry.startsAt);
  const end = companyCalendarDate(entry.endsAt) ?? start;
  if (!start || !end) return false;
  const last = end >= start ? end : start;
  return date >= start && date <= last;
}

/** Time off that covers these people during the job's appointment. */
export function timeOffForPeople(input: {
  timeOff: readonly DispatchTimeOffWindow[];
  people: readonly DispatchAssignee[];
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  targetDate?: string | null;
}): DispatchTimeOffWindow[] {
  const ids = new Set(
    input.people.filter((person) => !isLegacyAssignee(person)).map((person) => person.id),
  );
  if (ids.size === 0) return [];
  const start = input.scheduledStartAt ?? null;
  const end =
    input.scheduledEndAt ??
    (start ? new Date(Date.parse(start) + 60 * 60 * 1000).toISOString() : null);
  return input.timeOff.filter((entry) => {
    if (!ids.has(entry.userId)) return false;
    if (start && end && !Number.isNaN(Date.parse(start))) {
      return rangesOverlap(entry.startsAt, entry.endsAt, start, end);
    }
    if (input.targetDate) return coversDate(entry, input.targetDate);
    return false;
  });
}
