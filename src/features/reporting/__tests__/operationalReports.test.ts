import { describe, expect, it } from "vitest";

import {
  buildJobTiming,
  computeCallbackReport,
  computeInstallReport,
  computeOperationalReports,
  computePipelineReport,
  computeTechScorecards,
  currentMonthKey,
  isValidMonth,
  monthLabel,
  reportMonthOf,
  scheduledDateOf,
  toDatePart,
  type ReportJobRow,
  type ReportStatusActivity,
} from "../utils/operationalReports";

function job(overrides: Partial<ReportJobRow> = {}): ReportJobRow {
  return {
    id: "job-1",
    jobNumber: "JOB-1",
    type: "Install",
    status: "Scheduled",
    title: "Furnace install",
    customerName: "Acme",
    propertyName: "HQ",
    assignedTo: "Tech A",
    scheduledStartAt: "2026-09-10T09:00:00-07:00",
    scheduledFor: "2026-09-10",
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function activity(
  overrides: Partial<ReportStatusActivity> = {},
): ReportStatusActivity {
  return {
    jobId: "job-1",
    title: "Job completed",
    createdAt: "2026-09-10T17:00:00Z",
    ...overrides,
  };
}

describe("date helpers", () => {
  it("toDatePart extracts the date from ISO timestamps and date strings", () => {
    expect(toDatePart("2026-09-10T09:00:00-07:00")).toBe("2026-09-10");
    expect(toDatePart("2026-09-10")).toBe("2026-09-10");
    expect(toDatePart(null)).toBeNull();
    expect(toDatePart("garbage")).toBeNull();
  });

  it("scheduledDateOf prefers the real timestamp over the legacy date", () => {
    expect(scheduledDateOf(job())).toBe("2026-09-10");
    expect(
      scheduledDateOf(job({ scheduledStartAt: null, scheduledFor: "2026-09-12" })),
    ).toBe("2026-09-12");
    expect(
      scheduledDateOf(job({ scheduledStartAt: null, scheduledFor: null })),
    ).toBeNull();
  });

  it("reportMonthOf falls back to the created month when unscheduled", () => {
    expect(reportMonthOf(job())).toBe("2026-09");
    expect(
      reportMonthOf(
        job({ scheduledStartAt: null, scheduledFor: null, createdAt: "2026-08-20T00:00:00Z" }),
      ),
    ).toBe("2026-08");
  });

  it("validates month keys", () => {
    expect(isValidMonth("2026-09")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("sept")).toBe(false);
  });

  it("formats month labels and the current month key", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(currentMonthKey(new Date("2026-09-29T12:00:00"))).toBe("2026-09");
  });
});

describe("buildJobTiming", () => {
  it("takes the latest Job completed activity as the completion date", () => {
    const timing = buildJobTiming(
      [job()],
      [
        activity({ createdAt: "2026-09-10T17:00:00Z" }),
        activity({ createdAt: "2026-09-11T09:00:00Z" }),
      ],
    );
    expect(timing.get("job-1")?.completedDate).toBe("2026-09-11");
  });

  it("ignores non-completion status activities for the completion date", () => {
    const timing = buildJobTiming(
      [job()],
      [activity({ title: "Status updated", createdAt: "2026-09-12T09:00:00Z" })],
    );
    expect(timing.get("job-1")?.completedDate).toBeNull();
    expect(timing.get("job-1")?.terminalDate).toBe("2026-09-12");
  });

  it("falls back to updated_at for terminal jobs with no activity history", () => {
    const timing = buildJobTiming(
      [job({ status: "Cancelled", updatedAt: "2026-09-15T00:00:00Z" })],
      [],
    );
    expect(timing.get("job-1")?.terminalDate).toBe("2026-09-15");
  });

  it("leaves timing null for open jobs with no activity", () => {
    const timing = buildJobTiming([job({ status: "Scheduled" })], []);
    expect(timing.get("job-1")).toEqual({ completedDate: null, terminalDate: null });
  });
});

describe("computeInstallReport", () => {
  it("buckets installs by week of month and by tech", () => {
    const jobs = [
      job({ id: "a", scheduledStartAt: "2026-09-03T09:00:00-07:00", assignedTo: "Tech A" }),
      job({ id: "b", scheduledStartAt: "2026-09-10T09:00:00-07:00", assignedTo: "Tech B" }),
      job({ id: "c", scheduledStartAt: "2026-09-11T09:00:00-07:00", assignedTo: "Tech A" }),
      job({ id: "d", type: "Service" }),
    ];
    const report = computeInstallReport(jobs, "2026-09");
    expect(report.total).toBe(3);
    expect(report.byWeek[0].count).toBe(1);
    expect(report.byWeek[1].count).toBe(2);
    expect(report.byTech).toEqual([
      { tech: "Tech A", count: 2 },
      { tech: "Tech B", count: 1 },
    ]);
  });

  it("counts unscheduled installs separately and excludes other months", () => {
    const jobs = [
      job({ id: "a", scheduledStartAt: null, scheduledFor: null }),
      job({ id: "b", scheduledStartAt: "2026-08-28T09:00:00-07:00" }),
    ];
    const report = computeInstallReport(jobs, "2026-09");
    expect(report.total).toBe(1);
    expect(report.unscheduled).toBe(1);
  });

  it("labels unassigned techs", () => {
    const report = computeInstallReport(
      [job({ assignedTo: "  " })],
      "2026-09",
    );
    expect(report.byTech).toEqual([{ tech: "Unassigned", count: 1 }]);
  });
});

describe("computePipelineReport", () => {
  it("separates open estimates, scheduled work, completions, and close rate", () => {
    const jobs = [
      job({ id: "e1", type: "Estimate", status: "Scheduled", title: "Bid 1" }),
      job({ id: "e2", type: "Estimate", status: "In Progress", title: "Bid 2" }),
      job({
        id: "e3",
        type: "Estimate",
        status: "Completed",
        title: "Bid 3",
        updatedAt: "2026-09-14T00:00:00Z",
      }),
      job({
        id: "e4",
        type: "Estimate",
        status: "Cancelled",
        title: "Bid 4",
        updatedAt: "2026-09-16T00:00:00Z",
      }),
      job({ id: "s1", type: "Service", status: "Scheduled" }),
      job({ id: "c1", type: "Install", status: "Completed" }),
    ];
    const activities = [
      activity({ jobId: "c1", createdAt: "2026-09-10T17:00:00Z" }),
      activity({ jobId: "e3", createdAt: "2026-09-14T12:00:00Z" }),
      activity({
        jobId: "e4",
        title: "Status updated",
        createdAt: "2026-09-16T12:00:00Z",
      }),
    ];
    const timing = buildJobTiming(jobs, activities);
    const report = computePipelineReport(jobs, timing, "2026-09");

    expect(report.openEstimates).toBe(2);
    expect(report.scheduledJobs).toBe(1);
    expect(report.completedInMonth).toBe(1);
    expect(report.estimatesWon).toBe(1);
    expect(report.estimatesLost).toBe(1);
    expect(report.closeRate).toBe(0.5);
  });

  it("returns a null close rate when nothing closed in the month", () => {
    const jobs = [job({ id: "e1", type: "Estimate", status: "Scheduled" })];
    const report = computePipelineReport(jobs, buildJobTiming(jobs, []), "2026-09");
    expect(report.closeRate).toBeNull();
  });

  it("excludes callbacks from the scheduled-work count", () => {
    const jobs = [
      job({ id: "s1", type: "Service", status: "Scheduled" }),
      job({ id: "cb1", type: "Callback", status: "Scheduled" }),
    ];
    const report = computePipelineReport(jobs, buildJobTiming(jobs, []), "2026-09");
    expect(report.scheduledJobs).toBe(1);
  });
});

describe("computeTechScorecards", () => {
  it("computes jobs done, on-time %, callbacks, and booked work per tech", () => {
    const jobs = [
      job({
        id: "j1",
        assignedTo: "Tech A",
        status: "Completed",
        scheduledStartAt: "2026-09-10T09:00:00-07:00",
      }),
      job({
        id: "j2",
        assignedTo: "Tech A",
        status: "Completed",
        scheduledStartAt: "2026-09-10T09:00:00-07:00",
      }),
      job({
        id: "j3",
        assignedTo: "Tech A",
        status: "Scheduled",
        scheduledStartAt: "2026-10-02T09:00:00-07:00",
      }),
      job({
        id: "cb1",
        type: "Callback",
        assignedTo: "Tech A",
        status: "Completed",
        scheduledStartAt: "2026-09-12T09:00:00-07:00",
      }),
    ];
    const activities = [
      activity({ jobId: "j1", createdAt: "2026-09-10T16:00:00Z" }),
      activity({ jobId: "j2", createdAt: "2026-09-12T16:00:00Z" }),
      activity({ jobId: "cb1", createdAt: "2026-09-12T16:00:00Z" }),
    ];
    const scorecards = computeTechScorecards(
      jobs,
      buildJobTiming(jobs, activities),
      "2026-09",
    );

    expect(scorecards).toHaveLength(1);
    const card = scorecards[0];
    expect(card.tech).toBe("Tech A");
    expect(card.jobsDone).toBe(3);
    expect(card.onTimePct).toBeCloseTo(2 / 3);
    expect(card.callbacks).toBe(1);
    expect(card.callbackRate).toBeCloseTo(1 / 3);
    expect(card.booked).toBe(1);
  });

  it("returns null rates when there is no data", () => {
    const scorecards = computeTechScorecards(
      [job({ status: "Scheduled", scheduledStartAt: "2026-10-02T09:00:00-07:00" })],
      buildJobTiming([job()], []),
      "2026-09",
    );
    const card = scorecards[0];
    expect(card.jobsDone).toBe(0);
    expect(card.onTimePct).toBeNull();
    expect(card.callbackRate).toBeNull();
    expect(card.booked).toBe(1);
  });
});

describe("computeCallbackReport", () => {
  it("lists callback jobs for the month grouped by tech", () => {
    const jobs = [
      job({ id: "cb1", type: "Callback", assignedTo: "Tech B", title: "No heat callback" }),
      job({ id: "cb2", type: "Callback", assignedTo: "Tech B" }),
      job({ id: "s1", type: "Service" }),
    ];
    const report = computeCallbackReport(jobs, "2026-09");
    expect(report.total).toBe(2);
    expect(report.byTech).toEqual([{ tech: "Tech B", count: 2 }]);
    expect(report.jobs[0].title).toBe("No heat callback");
  });
});

describe("computeOperationalReports", () => {
  it("assembles all four reports for the month", () => {
    const jobs = [
      job({ id: "i1", type: "Install", status: "Completed" }),
      job({ id: "e1", type: "Estimate", status: "Scheduled" }),
      job({ id: "cb1", type: "Callback", status: "Completed" }),
    ];
    const reports = computeOperationalReports(
      jobs,
      [activity({ jobId: "i1" }), activity({ jobId: "cb1" })],
      "2026-09",
    );
    expect(reports.month).toBe("2026-09");
    expect(reports.monthLabel).toBe("September 2026");
    expect(reports.install.total).toBe(1);
    expect(reports.pipeline.openEstimates).toBe(1);
    expect(reports.techScorecards[0].jobsDone).toBe(2);
    expect(reports.callbacks.total).toBe(1);
  });
});
