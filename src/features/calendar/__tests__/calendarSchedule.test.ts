import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Job, JobAppointmentHour, JobStatus, JobType } from "@/features/jobs/types/job";

import {
  calendarJobHeading,
  calendarJobSubtitle,
  calendarStartMs,
  calendarTechLabel,
  calendarTechnicianNames,
  compareCalendarJobs,
  formatCalendarTimeRange,
  formatCompanyClock,
  formatMonthTitle,
  formatWeekRangeLabel,
  groupJobsByDate,
  isJobScheduled,
  jobCalendarDates,
  parseCalendarView,
  resolveCalendarView,
  startOfWeek,
  weekDates,
} from "../utils/calendarSchedule";

const previousZone = process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE;

beforeEach(() => {
  process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE = "America/Los_Angeles";
});

afterEach(() => {
  if (previousZone === undefined) {
    delete process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE;
  } else {
    process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE = previousZone;
  }
});

function job(partial: Partial<Job> & Pick<Job, "id">): Job {
  return {
    jobNumber: partial.id.toUpperCase(),
    title: "Service call",
    type: "Service",
    status: "Scheduled",
    priority: "Medium",
    customerName: "Customer",
    propertyName: "Property",
    assignedTo: "Alex Tech",
    scheduledFor: "2026-10-30",
    summary: "",
    location: "",
    notes: "",
    ...partial,
  };
}

describe("jobCalendarDates", () => {
  it("leaves unscheduled jobs off the board", () => {
    expect(
      jobCalendarDates(
        job({
          id: "open",
          scheduledFor: null,
          scheduledStartAt: null,
          scheduledEndAt: null,
        }),
      ),
    ).toEqual([]);
    expect(isJobScheduled(job({ id: "open", scheduledFor: null, scheduledStartAt: null }))).toBe(
      false,
    );
  });

  it("uses the company date of the start instant, not the UTC date", () => {
    // 11:00–11:45 pm Pacific on Oct 29 is already Oct 30 in UTC.
    const dates = jobCalendarDates(
      job({
        id: "late",
        scheduledFor: "2026-10-30",
        scheduledStartAt: "2026-10-30T06:00:00.000Z",
        scheduledEndAt: "2026-10-30T06:45:00.000Z",
      }),
    );
    expect(dates).toEqual(["2026-10-29"]);
  });

  it("keeps a legacy date-only job on that date when no clock time is stored", () => {
    expect(
      jobCalendarDates(
        job({
          id: "legacy",
          scheduledFor: "2026-10-28",
          scheduledStartAt: null,
          scheduledEndAt: null,
        }),
      ),
    ).toEqual(["2026-10-28"]);
  });

  it("includes a job that only has a start instant", () => {
    expect(
      jobCalendarDates(
        job({
          id: "clock-only",
          scheduledFor: null,
          scheduledStartAt: "2026-10-30T16:00:00.000Z",
        }),
      ),
    ).toEqual(["2026-10-30"]);
  });

  it("lists every company date from start through end, inclusive", () => {
    const dates = jobCalendarDates(
      job({
        id: "span",
        scheduledFor: "2026-10-28",
        scheduledStartAt: "2026-10-28T16:00:00.000Z",
        scheduledEndAt: "2026-10-30T20:00:00.000Z",
      }),
    );
    expect(dates).toEqual(["2026-10-28", "2026-10-29", "2026-10-30"]);
  });

  it("does not spill onto the next day when the end is the same company date", () => {
    expect(
      jobCalendarDates(
        job({
          id: "same-day",
          scheduledStartAt: "2026-10-30T15:00:00.000Z",
          scheduledEndAt: "2026-10-31T01:00:00.000Z",
        }),
      ),
    ).toEqual(["2026-10-30"]);
  });

  it("spans the fall-back weekend in Pacific time", () => {
    // 11:00 pm PDT Oct 31 through 9:00 am PST Nov 1.
    expect(
      jobCalendarDates(
        job({
          id: "fallback",
          scheduledFor: "2026-10-31",
          scheduledStartAt: "2026-11-01T06:00:00.000Z",
          scheduledEndAt: "2026-11-01T17:00:00.000Z",
        }),
      ),
    ).toEqual(["2026-10-31", "2026-11-01"]);
  });

  it("stops a far-future end date from building an unbounded list", () => {
    const dates = jobCalendarDates(
      job({
        id: "long",
        scheduledFor: "2026-01-01",
        scheduledStartAt: "2026-01-01T16:00:00.000Z",
        scheduledEndAt: "2028-01-01T16:00:00.000Z",
      }),
    );
    expect(dates.length).toBeGreaterThan(300);
    expect(dates.length).toBeLessThanOrEqual(367);
    expect(dates[0]).toBe("2026-01-01");
  });
});

describe("groupJobsByDate", () => {
  it("sorts a busy day by start time and does not drop jobs", () => {
    const busy = Array.from({ length: 20 }, (_, index) => {
      // 15-minute steps from 15:00 UTC (8:00 am Pacific).
      const startHour = 15 + Math.floor((index * 15) / 60);
      const startMinute = (index * 15) % 60;
      const endMinuteTotal = index * 15 + 45;
      const endHour = 15 + Math.floor(endMinuteTotal / 60);
      const endMinute = endMinuteTotal % 60;
      const start = `2026-10-29T${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}:00.000Z`;
      const end = `2026-10-29T${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:00.000Z`;
      return job({
        id: `busy-${index}`,
        customerName: `Customer ${String(index).padStart(2, "0")}`,
        scheduledFor: "2026-10-29",
        scheduledStartAt: start,
        scheduledEndAt: end,
        title: `Visit ${index + 1}`,
      });
    }).reverse();

    const grouped = groupJobsByDate([
      ...busy,
      job({ id: "other-day", scheduledFor: "2026-10-30", scheduledStartAt: "2026-10-30T16:00:00.000Z" }),
      job({ id: "unscheduled", scheduledFor: null, scheduledStartAt: null }),
    ]);

    const day = grouped["2026-10-29"];
    expect(day).toHaveLength(20);
    expect(day.map((item) => item.id)).toEqual(busy.map((item) => item.id).reverse());
    expect(grouped["2026-10-30"]?.map((item) => item.id)).toEqual(["other-day"]);
    expect(grouped["2026-10-28"]).toBeUndefined();
    expect(Object.values(grouped).flat().some((item) => item.id === "unscheduled")).toBe(false);
  });

  it("orders a timestamped job ahead of a later legacy appointment hour", () => {
    const early = job({
      id: "clock",
      customerName: "Zulu",
      scheduledStartAt: "2026-10-30T14:30:00.000Z",
    });
    const later = job({
      id: "legacy",
      customerName: "Alpha",
      scheduledFor: "2026-10-30",
      scheduledStartAt: null,
      appointmentHour: 8 as JobAppointmentHour,
    });
    const grouped = groupJobsByDate([later, early]);
    expect(grouped["2026-10-30"].map((item) => item.id)).toEqual(["clock", "legacy"]);
    expect(calendarStartMs(early)).toBeLessThan(calendarStartMs(later) ?? 0);
  });

  it("breaks a tie on customer name, then id", () => {
    const start = "2026-10-30T16:00:00.000Z";
    const grouped = groupJobsByDate([
      job({ id: "b", customerName: "Cedar", scheduledStartAt: start }),
      job({ id: "a", customerName: "Alder", scheduledStartAt: start }),
      job({ id: "c", customerName: "Alder", scheduledStartAt: start }),
    ]);
    expect(grouped["2026-10-30"].map((item) => item.id)).toEqual(["a", "c", "b"]);
  });

  it("keeps a job that started yesterday above later appointments the next day", () => {
    const span = job({
      id: "install",
      customerName: "Northwind",
      type: "Install",
      scheduledFor: "2026-10-28",
      scheduledStartAt: "2026-10-28T22:00:00.000Z",
      scheduledEndAt: "2026-10-29T20:00:00.000Z",
    });
    const morning = job({
      id: "morning",
      customerName: "Harbor",
      scheduledFor: "2026-10-29",
      scheduledStartAt: "2026-10-29T15:00:00.000Z",
      scheduledEndAt: "2026-10-29T16:00:00.000Z",
    });
    const grouped = groupJobsByDate([span, morning]);
    expect(grouped["2026-10-28"].map((item) => item.id)).toEqual(["install"]);
    expect(grouped["2026-10-29"].map((item) => item.id)).toEqual(["install", "morning"]);
  });

  it("sorts jobs with no time after jobs that have one", () => {
    const timed = job({ id: "timed", scheduledStartAt: "2026-10-30T20:00:00.000Z" });
    const open = job({
      id: "open",
      scheduledFor: "2026-10-30",
      scheduledStartAt: null,
      appointmentHour: undefined,
    });
    expect(compareCalendarJobs(open, timed)).toBeGreaterThan(0);
    expect(groupJobsByDate([open, timed])["2026-10-30"].map((item) => item.id)).toEqual([
      "timed",
      "open",
    ]);
  });
});

describe("formatCalendarTimeRange", () => {
  it("formats a Pacific summer range with leading zeros", () => {
    expect(
      formatCalendarTimeRange(
        job({
          id: "summer",
          scheduledStartAt: "2026-07-29T16:00:00.000Z",
          scheduledEndAt: "2026-07-29T21:30:00.000Z",
        }),
        "2026-07-29",
      ),
    ).toBe("09:00 am - 02:30 pm");
  });

  it("formats a Pacific winter morning, after standard time has returned", () => {
    expect(formatCompanyClock("2026-12-15T16:00:00.000Z")).toBe("08:00 am");
    expect(
      formatCalendarTimeRange(
        job({
          id: "winter",
          scheduledStartAt: "2026-12-15T16:00:00.000Z",
          scheduledEndAt: "2026-12-15T17:30:00.000Z",
        }),
      ),
    ).toBe("08:00 am - 09:30 am");
  });

  it("labels the spring-forward morning in company wall time", () => {
    // 1:30 am PST still exists. 2:30 am does not; 10:30 UTC is 3:30 am PDT.
    expect(formatCompanyClock("2026-03-08T09:30:00.000Z")).toBe("01:30 am");
    expect(formatCompanyClock("2026-03-08T10:30:00.000Z")).toBe("03:30 am");
  });

  it("labels the repeated hour on the fall-back morning without changing the date", () => {
    expect(formatCompanyClock("2026-11-01T08:30:00.000Z")).toBe("01:30 am");
    expect(formatCompanyClock("2026-11-01T09:30:00.000Z")).toBe("01:30 am");
    expect(
      jobCalendarDates(
        job({
          id: "repeat",
          scheduledFor: null,
          scheduledStartAt: "2026-11-01T09:30:00.000Z",
          scheduledEndAt: "2026-11-01T18:00:00.000Z",
        }),
      ),
    ).toEqual(["2026-11-01"]);
  });

  it("describes a multi-day job differently on the start, middle, and end days", () => {
    const span = job({
      id: "span",
      scheduledFor: "2026-10-28",
      scheduledStartAt: "2026-10-28T23:00:00.000Z",
      scheduledEndAt: "2026-10-30T16:00:00.000Z",
    });
    expect(formatCalendarTimeRange(span, "2026-10-28")).toBe("Starts 04:00 pm");
    expect(formatCalendarTimeRange(span, "2026-10-29")).toBe("All day");
    expect(formatCalendarTimeRange(span, "2026-10-30")).toBe("Ends 09:00 am");
  });

  it("falls back to the legacy appointment hour when no clock time is stored", () => {
    expect(
      formatCalendarTimeRange(
        job({
          id: "hour",
          scheduledStartAt: null,
          scheduledEndAt: null,
          appointmentHour: 9,
        }),
        "2026-10-30",
      ),
    ).toBe("09:00 am");
    expect(
      formatCalendarTimeRange(
        job({
          id: "noon",
          scheduledStartAt: null,
          appointmentHour: 12,
        }),
      ),
    ).toBe("12:00 pm");
  });

  it("says when a time was never set", () => {
    expect(
      formatCalendarTimeRange(
        job({
          id: "none",
          scheduledFor: "2026-10-30",
          scheduledStartAt: null,
          appointmentHour: undefined,
        }),
      ),
    ).toBe("Time not set");
  });

  it("follows the configured company timezone", () => {
    process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE = "America/New_York";
    expect(formatCompanyClock("2026-07-29T16:00:00.000Z")).toBe("12:00 pm");
  });
});

describe("calendar card text", () => {
  it("uses the customer name, and the title when the customer is missing", () => {
    expect(calendarJobHeading(job({ id: "a", customerName: "Harbor HOA", title: "Tune-up" }))).toBe(
      "Harbor HOA",
    );
    expect(calendarJobSubtitle(job({ id: "a", customerName: "Harbor HOA", title: "Tune-up" }))).toBe(
      "Tune-up",
    );
    expect(calendarJobHeading(job({ id: "b", customerName: "  ", title: "Compressor" }))).toBe(
      "Compressor",
    );
    expect(calendarJobSubtitle(job({ id: "b", customerName: "  ", title: "Compressor" }))).toBeNull();
  });

  it("prefers multi-assign names over the legacy assigned-to string", () => {
    const assigned = job({
      id: "crew",
      assignedTo: "Someone Else",
      assignees: [
        { id: "1", name: "Brian Ramirez" },
        { id: "2", name: "Sean Ryan" },
      ],
    });
    expect(calendarTechnicianNames(assigned)).toEqual(["Brian Ramirez", "Sean Ryan"]);
    expect(calendarTechLabel(assigned)).toBe("Techs: Brian Ramirez, Sean Ryan");
  });

  it("splits a legacy comma-separated assigned-to list", () => {
    expect(
      calendarTechLabel(
        job({ id: "legacy", assignedTo: "Riley Morgan, Taylor Reed", assignees: [] }),
      ),
    ).toBe("Techs: Riley Morgan, Taylor Reed");
  });

  it("marks a job with nobody assigned", () => {
    expect(calendarTechLabel(job({ id: "open", assignedTo: "  ", assignees: [] }))).toBe(
      "Techs: Unassigned",
    );
  });
});

describe("week and view choice", () => {
  it("builds a Sunday–Saturday week and a cross-year label", () => {
    expect(startOfWeek("2026-10-30")).toBe("2026-10-25");
    expect(weekDates("2026-10-30")).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
    expect(formatWeekRangeLabel("2026-10-25", "2026-10-31")).toBe("Oct 25 – 31, 2026");
    expect(formatWeekRangeLabel("2026-12-27", "2027-01-02")).toBe("Dec 27, 2026 – Jan 2, 2027");
    expect(formatMonthTitle(2026, 9)).toBe("October 2026");
  });

  it("lets a shared link win over the saved view, and ignores junk", () => {
    expect(resolveCalendarView({ urlView: "week", storedView: "month" })).toBe("week");
    expect(resolveCalendarView({ urlView: null, storedView: "week" })).toBe("week");
    expect(resolveCalendarView({ urlView: "agenda", storedView: "nope" })).toBe("month");
    expect(parseCalendarView("week")).toBe("week");
    expect(parseCalendarView("day")).toBeNull();
  });
});

describe("status and type stay on the job", () => {
  it("does not filter cancelled or in-progress work out of the day", () => {
    const statuses: JobStatus[] = ["Scheduled", "In Progress", "On Hold", "Completed", "Cancelled"];
    const types: JobType[] = ["Install", "Service", "Maintenance", "Inspection", "Estimate", "Callback"];
    const grouped = groupJobsByDate(
      statuses.map((status, index) =>
        job({
          id: status,
          status,
          type: types[index] ?? "Service",
          customerName: status,
          scheduledStartAt: `2026-10-30T${String(15 + index).padStart(2, "0")}:00:00.000Z`,
        }),
      ),
    );
    expect(grouped["2026-10-30"]).toHaveLength(statuses.length);
  });
});
