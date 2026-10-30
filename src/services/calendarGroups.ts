import "server-only";

import type { CalendarQuickGroup } from "@/features/calendar/utils/calendarPeopleFilter";
import { canManageCalendarEntries } from "@/features/calendar/types/calendarEntries";
import {
  createCalendarGroup,
  deleteCalendarGroup,
  listCalendarGroups,
  updateCalendarGroup,
} from "@/repositories/calendarGroups";
import type { AppRole } from "@/services/authorization";

function requireOffice(role: AppRole): void {
  if (!canManageCalendarEntries(role)) {
    throw Object.assign(new Error("You cannot change calendar groups."), { status: 403 });
  }
}

export async function listSharedCalendarGroups(role: AppRole): Promise<CalendarQuickGroup[]> {
  requireOffice(role);
  return listCalendarGroups();
}

export async function saveSharedCalendarGroup(
  role: AppRole,
  input: { id?: string; name: string; personIds: string[] },
): Promise<CalendarQuickGroup> {
  requireOffice(role);
  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error("Invalid group name. Use 1 to 80 characters.");
  if (input.id) return updateCalendarGroup(input.id, name, input.personIds);
  return createCalendarGroup(name, input.personIds);
}

export async function removeSharedCalendarGroup(role: AppRole, id: string): Promise<void> {
  requireOffice(role);
  await deleteCalendarGroup(id);
}
