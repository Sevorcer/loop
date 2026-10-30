import { describe, expect, it } from "vitest";

import { canSeeJobRevenue } from "../utils/revenueAccess";
import {
  companyPresetRange,
  computeProductionReport,
  equalShareCents,
  formatRevenueCents,
  productionReportToCsv,
  redactProductionReport,
  resolvePresetRange,
  scheduledHoursOf,
  type ProductionCompletion,
  type ProductionSourceJob,
} from "../utils/productionReport";

function job(overrides: Partial<ProductionSourceJob> = {}): ProductionSourceJob {
  return {
    id: "job-1",
    jobNumber: "JOB-1",
    status: "Completed",
    title: "Furnace install",
    customerName: "Northwind",
    assignedTo: "Alex Nguyen",
    scheduledStartAt: "2026-10-08T08:00:00-07:00",
    scheduledEndAt: "2026-10-08T14:00:00-07:00",
    estimatedDurationHours: 8,
    revenueCents: null,
    updatedAt: "2026-10-08T22:00:00Z",
    ...overrides,
  };
}

describe("date presets", () => {
  const friday = "2026-10-30";

  it("uses Monday through Sunday for this week", () => {
    expect(resolvePresetRange("this-week", friday)).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
    });
  });

  it("uses the calendar month and the previous month", () => {
    expect(resolvePresetRange("this-month", friday)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(resolvePresetRange("last-month", friday)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("keeps October when it is 6 PM Pacific on October 31", () => {
    const evening = new Date("2026-11-01T01:00:00.000Z");
    expect(companyPresetRange("this-month", evening, "America/Los_Angeles")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(companyPresetRange("last-month", evening, "America/Los_Angeles")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(companyPresetRange("this-week", evening, "America/Los_Angeles")).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
    });
  });
});

describe("scheduled hours", () => {
  it("uses the scheduled window before the dispatch estimate", () => {
    expect(scheduledHoursOf(job())).toBe(6);
  });

  it("uses the dispatch estimate when the window is missing or reversed", () => {
    expect(
      scheduledHoursOf(job({ scheduledStartAt: null, scheduledEndAt: null, estimatedDurationHours: 3 })),
    ).toBe(3);
    expect(
      scheduledHoursOf(
        job({
          scheduledStartAt: "2026-10-08T14:00:00-07:00",
          scheduledEndAt: "2026-10-08T08:00:00-07:00",
          estimatedDurationHours: 4,
        }),
      ),
    ).toBe(4);
  });

  it("returns null when neither source exists", () => {
    expect(
      scheduledHoursOf(job({ scheduledStartAt: null, scheduledEndAt: null, estimatedDurationHours: 0 })),
    ).toBeNull();
  });
});

describe("equal share", () => {
  it("gives leftover cents to the earliest names", () => {
    expect(equalShareCents(100, 3, 0)).toBe(34);
    expect(equalShareCents(100, 3, 1)).toBe(33);
    expect(equalShareCents(100, 3, 2)).toBe(33);
  });
});

describe("production report", () => {
  const range = { from: "2026-10-01", to: "2026-10-31" };
  const completions: ProductionCompletion[] = [
    { jobId: "job-1", createdAt: "2026-10-08T21:00:00Z" },
    { jobId: "job-2", createdAt: "2026-10-15T21:00:00Z" },
  ];

  const shared = job({
    id: "job-1",
    revenueCents: 100,
    completionTeam: [
      { id: "brian", name: "Brian Ramirez" },
      { id: "alex", name: "Alex Nguyen" },
    ],
    assignees: [{ id: "jordan", name: "Jordan Blake" }],
  });
  const second = job({
    id: "job-2",
    jobNumber: "JOB-2",
    scheduledStartAt: null,
    scheduledEndAt: null,
    estimatedDurationHours: 3,
    revenueCents: null,
    completionTeam: [
      { id: "priya", name: "Priya Shah" },
    ],
    updatedAt: "2026-10-15T22:00:00Z",
  });

  it("credits the completion team, not whoever is assigned later", () => {
    const report = computeProductionReport([shared, second], completions, range);
    expect(report.teams.map((team) => team.label)).toEqual(["Alex Nguyen + Brian Ramirez", "Priya Shah"]);
    expect(report.people.map((person) => person.label)).toEqual(["Alex Nguyen", "Brian Ramirez", "Priya Shah"]);
    expect(report.people.some((person) => person.label === "Jordan Blake")).toBe(false);
  });

  it("keeps full revenue on the team and splits it across people", () => {
    const report = computeProductionReport([shared], completions, range);
    expect(report.totals.jobs).toBe(1);
    expect(report.totals.revenueCents).toBe(100);
    expect(report.totals.averageTicketCents).toBe(100);
    expect(report.totals.scheduledHours).toBe(6);
    expect(report.teams[0].revenueCents).toBe(100);
    const alex = report.people.find((person) => person.label === "Alex Nguyen");
    const brian = report.people.find((person) => person.label === "Brian Ramirez");
    expect(alex?.equalShareCents).toBe(50);
    expect(brian?.equalShareCents).toBe(50);
    expect(alex?.fullJobRevenueCents).toBe(100);
    expect(brian?.scheduledHours).toBe(6);
  });

  it("leaves revenue unrecorded when no amount is stored", () => {
    const report = computeProductionReport([second], completions, range);
    expect(report.totals.revenueCents).toBeNull();
    expect(report.totals.averageTicketCents).toBeNull();
    expect(report.totals.scheduledHours).toBe(3);
    expect(formatRevenueCents(report.totals.revenueCents)).toBe("Not recorded");
  });

  it("counts a job completed at 6 PM Pacific on October 31 in October", () => {
    const completedAt = "2026-11-01T01:00:00.000Z";
    const evening = job({
      id: "evening",
      jobNumber: "JOB-31",
      updatedAt: "2026-11-02T00:00:00.000Z",
    });
    const report = computeProductionReport(
      [evening],
      [{ jobId: "evening", createdAt: completedAt }],
      range,
      "America/Los_Angeles",
    );
    expect(report.totals.jobs).toBe(1);
    expect(report.jobs.map((line) => line.completedOn)).toEqual(["2026-10-31"]);

    const november = computeProductionReport(
      [evening],
      [{ jobId: "evening", createdAt: completedAt }],
      { from: "2026-11-01", to: "2026-11-30" },
      "America/Los_Angeles",
    );
    expect(november.totals.jobs).toBe(0);

    const fromUpdatedAt = computeProductionReport(
      [job({ id: "evening", jobNumber: "JOB-31", updatedAt: completedAt })],
      [],
      range,
      "America/Los_Angeles",
    );
    expect(fromUpdatedAt.jobs.map((line) => line.completedOn)).toEqual(["2026-10-31"]);
  });

  it("ignores jobs completed outside the range and jobs that are still open", () => {
    const report = computeProductionReport(
      [
        shared,
        job({ id: "open", status: "In Progress", updatedAt: "2026-10-10T00:00:00Z" }),
        job({ id: "old", updatedAt: "2026-09-02T00:00:00Z" }),
      ],
      [{ jobId: "old", createdAt: "2026-09-02T00:00:00Z" }],
      range,
    );
    expect(report.totals.jobs).toBe(1);
    expect(report.jobs.map((line) => line.jobNumber)).toEqual(["JOB-1"]);
  });

  it("hides revenue from roles that must not see it, including the CSV", () => {
    const report = computeProductionReport([shared], completions, range);
    const hidden = redactProductionReport(report);
    const serialized = JSON.stringify(hidden);
    expect(hidden.canSeeRevenue).toBe(false);
    expect(serialized).not.toContain("100");
    expect(serialized).not.toContain("50");
    const csv = productionReportToCsv(hidden);
    expect(csv).not.toContain("Revenue");
    expect(csv).not.toContain("Average ticket");
    expect(csv).not.toContain("$");
    expect(csv).toContain("Scheduled hours");
    expect(csv).toContain("Alex Nguyen + Brian Ramirez");
    expect(canSeeJobRevenue("tech")).toBe(false);
    expect(canSeeJobRevenue("portal")).toBe(false);
    expect(canSeeJobRevenue("dispatch")).toBe(true);
    expect(canSeeJobRevenue("sales")).toBe(true);
    expect(canSeeJobRevenue("office")).toBe(true);
    expect(canSeeJobRevenue("owner")).toBe(true);
    expect(canSeeJobRevenue("manager")).toBe(true);
  });

  it("includes revenue in the CSV for sales and leaves it out for tech and portal", () => {
    const report = computeProductionReport([shared], completions, range);
    expect(report.canSeeRevenue).toBe(true);
    const csv = productionReportToCsv(report);
    expect(csv).toContain("Revenue");
    expect(csv).toContain("Average ticket");
    expect(csv).toContain("$1.00");
    expect(canSeeJobRevenue("sales")).toBe(true);

    for (const role of ["tech", "portal"] as const) {
      expect(canSeeJobRevenue(role)).toBe(false);
      const hidden = productionReportToCsv(redactProductionReport(report));
      expect(hidden).not.toContain("Revenue");
      expect(hidden).not.toContain("$");
    }
  });
});
