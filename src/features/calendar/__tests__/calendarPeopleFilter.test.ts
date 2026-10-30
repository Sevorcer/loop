import { describe, expect, it } from "vitest";

import type { Job } from "@/features/jobs/types/job";

import type { CalendarTaskEntry, TimeOffEntry } from "../types/calendarEntries";
import {
  filterCalendarByPeople,
  parseStoredPersonIds,
  parseStoredQuickGroups,
  quickGroupName,
} from "../utils/calendarPeopleFilter";

const brian = { id: "brian", name: "Brian Ramirez" };
const sean = { id: "sean", name: "Sean Ryan" };
const maya = { id: "maya", name: "Maya Singh" };

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    jobNumber: "JOB-1",
    title: "Changeout",
    type: "Install",
    status: "Scheduled",
    priority: "Medium",
    customerName: "Harbor HOA",
    propertyName: "Building A",
    assignedTo: "",
    scheduledFor: "2026-10-30",
    summary: "",
    location: "",
    notes: "",
    ...overrides,
  };
}

const sick: TimeOffEntry = {
  id: "off-1",
  userId: "maya",
  personName: "Maya Singh",
  startsAt: "2026-10-30T07:00:00.000Z",
  endsAt: "2026-10-31T07:00:00.000Z",
  allDay: true,
  reason: "Called out sick",
  note: "",
};

const everyoneTask: CalendarTaskEntry = {
  id: "task-all",
  title: "Standup",
  description: "",
  startsAt: "2026-10-30T15:00:00.000Z",
  endsAt: "2026-10-30T15:30:00.000Z",
  allDay: false,
  assignEveryone: true,
  assigneeIds: [],
  assigneeNames: [],
  jobId: null,
  jobNumber: null,
  customerId: null,
  customerName: null,
  doneAt: null,
};

const brianTask: CalendarTaskEntry = {
  ...everyoneTask,
  id: "task-brian",
  title: "Pick up parts",
  assignEveryone: false,
  assigneeIds: ["brian"],
  assigneeNames: ["Brian Ramirez"],
};

describe("filterCalendarByPeople", () => {
  const jobs = [
    job({
      id: "shared",
      assignees: [brian, sean],
      assignedTo: "Someone Else",
    }),
    job({
      id: "maya",
      assignees: [maya],
    }),
    job({
      id: "legacy",
      assignedTo: "Brian Ramirez",
      assignees: [],
    }),
  ];

  it("shows every job, time off, and task when nobody is picked", () => {
    const filtered = filterCalendarByPeople({
      jobs,
      timeOff: [sick],
      tasks: [everyoneTask, brianTask],
      selectedIds: [],
      people: [brian, sean, maya],
    });
    expect(filtered.jobs).toHaveLength(3);
    expect(filtered.timeOff).toHaveLength(1);
    expect(filtered.tasks).toHaveLength(2);
  });

  it("keeps jobs for any selected person, their time off, and everyone tasks", () => {
    const filtered = filterCalendarByPeople({
      jobs,
      timeOff: [sick],
      tasks: [everyoneTask, brianTask],
      selectedIds: ["brian", "sean"],
      people: [brian, sean, maya],
    });
    expect(filtered.jobs.map((item) => item.id).sort()).toEqual(["legacy", "shared"]);
    expect(filtered.timeOff).toHaveLength(0);
    expect(filtered.tasks.map((task) => task.id).sort()).toEqual(["task-all", "task-brian"]);
  });

  it("shows Maya's sick day when she is the only person selected", () => {
    const filtered = filterCalendarByPeople({
      jobs,
      timeOff: [sick],
      tasks: [everyoneTask],
      selectedIds: ["maya"],
      people: [brian, sean, maya],
    });
    expect(filtered.jobs.map((item) => item.id)).toEqual(["maya"]);
    expect(filtered.timeOff).toHaveLength(1);
    expect(filtered.tasks.map((task) => task.title)).toEqual(["Standup"]);
  });
});

describe("remembered people", () => {
  it("reads a saved selection and ignores junk", () => {
    expect(parseStoredPersonIds(JSON.stringify(["brian", "sean", "brian"]))).toEqual([
      "brian",
      "sean",
    ]);
    expect(parseStoredPersonIds("nope")).toEqual([]);
    expect(parseStoredPersonIds(null)).toEqual([]);
  });

  it("reads a saved group and names it from the people", () => {
    expect(
      parseStoredQuickGroups(
        JSON.stringify([{ id: "g1", name: "Brian + Sean", personIds: ["brian", "sean"] }]),
      ),
    ).toEqual([{ id: "g1", name: "Brian + Sean", personIds: ["brian", "sean"] }]);
    expect(quickGroupName([brian, sean], ["sean", "brian"])).toBe("Brian Ramirez + Sean Ryan");
  });
});
