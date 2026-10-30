import {
  CALENDAR_PEOPLE_GROUPS_KEY,
  parseStoredQuickGroups,
  type CalendarQuickGroup,
} from "./calendarPeopleFilter";

const importingSignatures = new Set<string>();

export function groupSignature(group: Pick<CalendarQuickGroup, "name" | "personIds">): string {
  const name = group.name.trim().toLowerCase();
  const ids = [...new Set(group.personIds.map((id) => id.trim()).filter(Boolean))].sort();
  return `${name}|${ids.join(",")}`;
}

/**
 * Groups saved in this browser that the office list does not already have.
 * A signature is claimed immediately so a second load does not create it twice.
 */
export function takeGroupsToImport(
  local: readonly CalendarQuickGroup[],
  remote: readonly CalendarQuickGroup[],
): CalendarQuickGroup[] {
  const known = new Set(remote.map((group) => groupSignature(group)));
  const taken: CalendarQuickGroup[] = [];
  for (const group of local) {
    const signature = groupSignature(group);
    if (known.has(signature) || importingSignatures.has(signature)) continue;
    importingSignatures.add(signature);
    known.add(signature);
    taken.push(group);
  }
  return taken;
}

export function mergeCalendarGroups(groups: readonly CalendarQuickGroup[]): CalendarQuickGroup[] {
  const seen = new Set<string>();
  const merged: CalendarQuickGroup[] = [];
  for (const group of groups) {
    const signature = groupSignature(group);
    if (seen.has(signature)) continue;
    seen.add(signature);
    merged.push(group);
  }
  return merged;
}

export function releaseGroupImport(group: CalendarQuickGroup): void {
  importingSignatures.delete(groupSignature(group));
}

export function resetGroupImportClaims(): void {
  importingSignatures.clear();
}

export function readLocalCalendarGroups(): CalendarQuickGroup[] {
  if (typeof window === "undefined") return [];
  try {
    return parseStoredQuickGroups(window.localStorage.getItem(CALENDAR_PEOPLE_GROUPS_KEY));
  } catch {
    return [];
  }
}

export function clearLocalCalendarGroups(): void {
  try {
    window.localStorage.removeItem(CALENDAR_PEOPLE_GROUPS_KEY);
  } catch {
    // Private browsing can block storage. The shared list is already loaded.
  }
}
