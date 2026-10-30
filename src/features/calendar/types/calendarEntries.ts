export interface CalendarPerson {
  id: string;
  name: string;
}

export interface TimeOffEntry {
  id: string;
  userId: string;
  personName: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason: string;
  note: string;
}

export interface CalendarTaskEntry {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  assignEveryone: boolean;
  assigneeIds: string[];
  assigneeNames: string[];
  jobId: string | null;
  jobNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  doneAt: string | null;
}

export const TIME_OFF_REASONS = [
  "Called out sick",
  "Regular scheduled day off",
  "Vacation",
  "Training",
  "Personal",
] as const;

export const CALENDAR_OFFICE_ROLES = ["owner", "manager", "dispatch", "office"] as const;

export function canManageCalendarEntries(role: string | null | undefined): boolean {
  return CALENDAR_OFFICE_ROLES.some((officeRole) => officeRole === role);
}
