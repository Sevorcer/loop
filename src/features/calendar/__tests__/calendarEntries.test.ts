import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Job } from "@/features/jobs/types/job";
import { canManageCalendarEntries } from "../types/calendarEntries";
import type { CalendarTaskEntry, TimeOffEntry } from "../types/calendarEntries";
import {
  allDayBounds,
  entryCalendarDates,
  formatEntryTime,
  groupCalendarBoard,
  rangesOverlap,
  taskAssigneeLabel,
  timeOffCovering,
} from "../utils/calendarEntries";

const previousZone = process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE;

beforeEach(() => {
  process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE = "America/Los_Angeles";
});

afterEach(() => {
  if (previousZone === undefined) delete process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE;
  else process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE = previousZone;
});

function timeOff(partial: Partial<TimeOffEntry> & Pick<TimeOffEntry, "id">): TimeOffEntry {
  return {
    userId: "user-1",
    personName: "Sean Ryan",
    startsAt: "2026-10-30T15:00:00.000Z",
    endsAt: "2026-10-30T17:00:00.000Z",
    allDay: false,
    reason: "Called out sick",
    note: "",
    ...partial,
  };
}

function task(partial: Partial<CalendarTaskEntry> & Pick<CalendarTaskEntry, "id">): CalendarTaskEntry {
  return {
    title: "Wait for the inspector",
    description: "",
    startsAt: "2026-10-30T16:00:00.000Z",
    endsAt: "2026-10-30T17:00:00.000Z",
    allDay: false,
    assignEveryone: false,
    assigneeIds: ["user-2"],
    assigneeNames: ["Colin Quakenbush"],
    jobId: null,
    jobNumber: null,
    customerId: null,
    customerName: null,
    doneAt: null,
    ...partial,
  };
}

function job(id: string, start: string): Job {
  return {
    id,
    jobNumber: id,
    title: "Service",
    type: "Service",
    status: "Scheduled",
    priority: "Medium",
    customerName: "Customer",
    propertyName: "Property",
    assignedTo: "Alex",
    scheduledFor: "2026-10-30",
    scheduledStartAt: start,
    summary: "",
    location: "",
    notes: "",
  };
}

describe("time off and task dates", () => {
  it("keeps a single all-day Pacific date on that date across the UTC boundary", () => {
    const bounds = allDayBounds("2026-10-30", "2026-10-30");
    expect(bounds).not.toBeNull();
    expect(entryCalendarDates(bounds!)).toEqual(["2026-10-30"]);
    expect(formatEntryTime({ ...bounds!, allDay: true }, "2026-10-30")).toBe("All day");
  });

  it("lists every day of a multi-day all-day block, including the fall-back weekend", () => {
    const bounds = allDayBounds("2026-10-30", "2026-11-02");
    expect(entryCalendarDates(bounds!)).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("rejects an all-day range that ends before it starts", () => {
    expect(allDayBounds("2026-11-02", "2026-10-30")).toBeNull();
  });

  it("labels a timed range in company time and a span across days", () => {
    const entry = timeOff({
      id: "span",
      startsAt: "2026-10-28T23:00:00.000Z",
      endsAt: "2026-10-30T16:00:00.000Z",
      allDay: false,
    });
    expect(formatEntryTime(entry, "2026-10-28")).toBe("Starts 04:00 pm");
    expect(formatEntryTime(entry, "2026-10-29")).toBe("All day");
    expect(formatEntryTime(entry, "2026-10-30")).toBe("Ends 09:00 am");
    expect(formatEntryTime(timeOff({ id: "morning" }), "2026-10-30")).toBe("08:00 am - 10:00 am");
  });
});

describe("time off conflicts", () => {
  it("finds a person who is off during the appointment", () => {
    const off = timeOff({
      id: "sick",
      userId: "sean",
      personName: "Sean Ryan",
      allDay: true,
      ...allDayBounds("2026-10-30", "2026-10-30")!,
    });
    const hits = timeOffCovering(
      [off],
      ["sean", "brian"],
      "2026-10-30T16:00:00.000Z",
      "2026-10-30T18:00:00.000Z",
    );
    expect(hits.map((entry) => entry.personName)).toEqual(["Sean Ryan"]);
  });

  it("ignores time off that ends before the appointment starts", () => {
    const off = timeOff({
      id: "morning",
      userId: "sean",
      startsAt: "2026-10-30T15:00:00.000Z",
      endsAt: "2026-10-30T16:00:00.000Z",
    });
    expect(
      timeOffCovering([off], ["sean"], "2026-10-30T16:00:00.000Z", "2026-10-30T17:00:00.000Z"),
    ).toEqual([]);
    expect(rangesOverlap(off.startsAt, off.endsAt, "2026-10-30T16:00:00.000Z", "2026-10-30T17:00:00.000Z")).toBe(
      false,
    );
  });
});

describe("calendar board", () => {
  it("mixes jobs, time off, and tasks on a day, earliest first, with no cap", () => {
    const grouped = groupCalendarBoard({
      jobs: [
        job("late", "2026-10-30T20:00:00.000Z"),
        job("early", "2026-10-30T15:30:00.000Z"),
      ],
      timeOff: [
        timeOff({
          id: "off",
          startsAt: "2026-10-30T14:00:00.000Z",
          endsAt: "2026-10-31T06:59:00.000Z",
          allDay: true,
        }),
      ],
      tasks: [
        task({ id: "errand", startsAt: "2026-10-30T18:00:00.000Z", endsAt: "2026-10-30T18:30:00.000Z" }),
        task({ id: "note", title: "Pizza giveaway", startsAt: "2026-10-30T17:00:00.000Z", endsAt: "2026-10-30T17:15:00.000Z" }),
      ],
    });
    expect(grouped["2026-10-30"].map((item) => item.id)).toEqual([
      "off",
      "early",
      "note",
      "errand",
      "late",
    ]);
    expect(grouped["2026-10-30"]).toHaveLength(5);
  });

  it("puts an everyone task and a named crew on the card label", () => {
    expect(taskAssigneeLabel(task({ id: "all", assignEveryone: true, assigneeNames: [] }))).toBe(
      "Assigned To: Everyone",
    );
    expect(
      taskAssigneeLabel(task({ id: "crew", assigneeNames: ["Brian Ramirez", "Sean Ryan"] })),
    ).toBe("Assigned To: Brian Ramirez, Sean Ryan");
  });
});

describe("who can edit the calendar extras", () => {
  it("lets office roles manage entries and leaves technicians read-only for time off", () => {
    expect(canManageCalendarEntries("owner")).toBe(true);
    expect(canManageCalendarEntries("manager")).toBe(true);
    expect(canManageCalendarEntries("dispatch")).toBe(true);
    expect(canManageCalendarEntries("office")).toBe(true);
    expect(canManageCalendarEntries("tech")).toBe(false);
    expect(canManageCalendarEntries("sales")).toBe(false);
    expect(canManageCalendarEntries(null)).toBe(false);
  });
});
