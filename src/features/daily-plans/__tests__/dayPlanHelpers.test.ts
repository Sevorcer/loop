import { describe, expect, it } from "vitest";

import type { Job } from "@/features/jobs/types/job";
import type { CrewRecord } from "../data/fieldCrews";
import {
  canEditDailyPlans,
  canViewDailyPlans,
  countPeopleWorking,
  crewLabelForJob,
  formatJobDayTime,
  getJobsForSelectedDate,
  getShortUpcomingJobs,
  jobAssigneeNames,
  jobIsAssigned,
  sortJobsForDayTable,
} from "../utils/dayPlanHelpers";
import { buildDailyCrewRoster } from "../data/fieldCrews";

function job(partial: Partial<Job> & Pick<Job, "id">): Job {
  return {
    jobNumber: partial.jobNumber ?? partial.id,
    title: partial.title ?? partial.id,
    type: "Service",
    status: "Scheduled",
    priority: "Medium",
    customerId: null,
    customerName: partial.customerName ?? "Acme Builder",
    propertyId: null,
    propertyName: partial.propertyName ?? "Site A",
    assignedTo: partial.assignedTo ?? "",
    assignees: partial.assignees ?? [],
    summary: "",
    location: partial.location ?? "100 Main St",
    notes: "",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    scheduledFor: partial.scheduledFor ?? "2026-11-05",
    scheduledStartAt: partial.scheduledStartAt ?? null,
    scheduledEndAt: partial.scheduledEndAt ?? null,
    arrivalWindowStartAt: partial.arrivalWindowStartAt ?? null,
    ...partial,
  } as Job;
}

describe("day plan multi-assignee helpers", () => {
  it("prefers job_assignees names over assignedTo", () => {
    const names = jobAssigneeNames(
      job({
        id: "1",
        assignedTo: "Legacy Only",
        assignees: [
          { id: "u1", name: "Alex Kim" },
          { id: "u2", name: "Sam Ortiz" },
        ],
      }),
    );
    expect(names).toEqual(["Alex Kim", "Sam Ortiz"]);
  });

  it("falls back to assignedTo when assignees are empty", () => {
    expect(jobAssigneeNames(job({ id: "1", assignedTo: "Casey Ng", assignees: [] }))).toEqual([
      "Casey Ng",
    ]);
    expect(jobIsAssigned(job({ id: "2", assignedTo: "", assignees: [] }))).toBe(false);
  });

  it("sorts the day table by start time then job number", () => {
    const sorted = sortJobsForDayTable([
      job({
        id: "b",
        jobNumber: "JOB-2",
        scheduledStartAt: "2026-11-05T18:00:00.000Z",
      }),
      job({
        id: "a",
        jobNumber: "JOB-1",
        scheduledStartAt: "2026-11-05T15:00:00.000Z",
      }),
      job({
        id: "c",
        jobNumber: "JOB-3",
        scheduledStartAt: null,
      }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("formats a readable time column", () => {
    expect(formatJobDayTime(job({ id: "1", scheduledStartAt: null }))).toBe("—");
    expect(
      formatJobDayTime(
        job({ id: "2", scheduledStartAt: "2026-11-05T16:30:00.000Z" }),
      ),
    ).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
  });

  it("labels truck/crew from membership without inventing data", () => {
    const crews: CrewRecord[] = [
      {
        id: "c1",
        name: "Install",
        lead_installer: "Alex Kim",
        members: ["Sam Ortiz"],
        certifications: [],
        availability: "available",
        van_name: "Van 2",
      },
    ];
    expect(
      crewLabelForJob(
        job({
          id: "1",
          assignees: [{ id: "u1", name: "Alex Kim" }],
        }),
        crews,
      ),
    ).toContain("Van 2");
    expect(
      crewLabelForJob(job({ id: "2", assignees: [], assignedTo: "" }), crews),
    ).toBe("—");
  });
});

describe("day plan ranged selection", () => {
  it("returns only jobs for the selected date", () => {
    const jobs = [
      job({ id: "today", scheduledFor: "2026-11-05" }),
      job({ id: "tomorrow", scheduledFor: "2026-11-06" }),
    ];
    expect(getJobsForSelectedDate(jobs, "2026-11-05").map((j) => j.id)).toEqual(["today"]);
  });

  it("limits upcoming to a short window after the selected date", () => {
    const jobs = [
      job({ id: "d1", scheduledFor: "2026-11-06" }),
      job({ id: "d2", scheduledFor: "2026-11-07" }),
      job({ id: "d3", scheduledFor: "2026-11-08" }),
      job({ id: "far", scheduledFor: "2026-11-20" }),
    ];
    expect(getShortUpcomingJobs(jobs, "2026-11-05", 3).map((j) => j.id)).toEqual([
      "d1",
      "d2",
      "d3",
    ]);
  });
});

describe("day plan role gating", () => {
  it("allows owner, manager, office, and dispatch to view and edit", () => {
    for (const role of ["owner", "manager", "office", "dispatch"]) {
      expect(canViewDailyPlans(role)).toBe(true);
      expect(canEditDailyPlans(role)).toBe(true);
    }
  });

  it("blocks tech, sales, and portal", () => {
    for (const role of ["tech", "sales", "portal", null, undefined]) {
      expect(canViewDailyPlans(role)).toBe(false);
      expect(canEditDailyPlans(role)).toBe(false);
    }
  });
});

describe("roster grouping with multi-assignee jobs", () => {
  it("groups every assignee name under matching crews and counts people working", () => {
    const dayJobs = [
      job({
        id: "1",
        assignees: [
          { id: "u1", name: "Alex Kim" },
          { id: "u2", name: "Sam Ortiz" },
        ],
      }),
      job({
        id: "2",
        assignees: [{ id: "u3", name: "Casey Ng" }],
      }),
    ];
    const roster = buildDailyCrewRoster({
      crews: [
        {
          id: "c1",
          name: "Install",
          lead_installer: "Alex Kim",
          members: ["Sam Ortiz"],
          certifications: [],
          availability: "available",
          van_name: "Van 2",
        },
      ],
      assignedNames: dayJobs.flatMap((item) => jobAssigneeNames(item)),
    });
    expect(roster.crewGroups).toHaveLength(1);
    expect(roster.crewGroups[0].assignedMembers.sort()).toEqual(["Alex Kim", "Sam Ortiz"].sort());
    expect(roster.floaters).toEqual(["Casey Ng"]);
    expect(countPeopleWorking(dayJobs)).toBe(3);
  });
});
