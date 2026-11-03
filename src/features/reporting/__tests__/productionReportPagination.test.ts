/**
 * Parity tests for the paged production report at import scale.
 *
 * The reporting screen used to receive every completed job row (thousands at
 * Service Fusion import scale) in one payload and render them all. The report
 * now ships a compact summary plus one page of the jobs list. These tests
 * prove, on a production-scale fixture, that:
 *
 *   1. the server-computed totals / by-team / by-person match a straightforward
 *      reference reduction over the raw fixtures, and
 *   2. slicing the report into pages changes no figure — every page carries the
 *      same totals/teams/people, and stitching the pages back together
 *      reproduces the whole jobs list in the same order.
 */

import { describe, expect, it } from "vitest";

import {
  PRODUCTION_JOBS_PAGE_SIZE,
  computeProductionReport,
  pageOfProductionReport,
  scheduledHoursOf,
  type ProductionCompletion,
  type ProductionReport,
  type ProductionSourceJob,
} from "../utils/productionReport";

const RANGE = { from: "2026-10-01", to: "2026-10-31" };
const TZ = "UTC";
const JOB_COUNT = 3500;

// A small pool of people so teams and persons aggregate across many jobs.
const PEOPLE = [
  { id: "u-alex", name: "Alex Nguyen" },
  { id: "u-brian", name: "Brian Ramirez" },
  { id: "u-casey", name: "Casey Lin" },
  { id: "u-dana", name: "Dana Ortiz" },
  { id: "u-erin", name: "Erin Walsh" },
  { id: "u-felix", name: "Felix Chen" },
];

function buildFixture(): { jobs: ProductionSourceJob[]; completions: ProductionCompletion[] } {
  const jobs: ProductionSourceJob[] = [];
  const completions: ProductionCompletion[] = [];

  for (let i = 0; i < JOB_COUNT; i += 1) {
    const id = `job-${String(i).padStart(5, "0")}`;
    // Teams of 1-3 people drawn from the pool.
    const teamSize = (i % 3) + 1;
    const team = Array.from({ length: teamSize }, (_, k) => PEOPLE[(i + k) % PEOPLE.length]);
    // Half the jobs carry revenue; integer hours keep the minute rounding exact.
    const hasRevenue = i % 2 === 0;
    const revenueCents = hasRevenue ? 100_000 + (i % 7) * 12_345 : null;
    const hours = (i % 8) + 1;
    // Completion day inside the range, spread across the month.
    const day = (i % 31) + 1;
    const createdAt = `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`;

    jobs.push({
      id,
      jobNumber: `SF-${String(i).padStart(5, "0")}`,
      status: "Completed",
      title: `Job ${i}`,
      customerName: `Customer ${i % 50}`,
      assignedTo: "",
      assignees: team,
      completionTeam: team,
      scheduledStartAt: null,
      scheduledEndAt: null,
      estimatedDurationHours: hours,
      revenueCents,
      updatedAt: createdAt,
    });
    completions.push({ jobId: id, createdAt });
  }

  return { jobs, completions };
}

const fixture = buildFixture();
const full = computeProductionReport(fixture.jobs, fixture.completions, RANGE, TZ);

describe("production report at import scale — reference reduction", () => {
  it("totals match a straightforward reduction over the fixtures", () => {
    let expectedJobs = 0;
    let expectedRevenue = 0;
    let expectedRevenueJobs = 0;
    let expectedHours = 0;
    for (const job of fixture.jobs) {
      expectedJobs += 1;
      const hours = scheduledHoursOf(job);
      if (hours != null) expectedHours += hours;
      if (job.revenueCents != null) {
        expectedRevenue += job.revenueCents;
        expectedRevenueJobs += 1;
      }
    }

    expect(full.totals.jobs).toBe(expectedJobs);
    expect(full.totals.jobs).toBe(JOB_COUNT);
    expect(full.totals.revenueCents).toBe(expectedRevenue);
    expect(full.totals.jobsWithRevenue).toBe(expectedRevenueJobs);
    expect(full.totals.scheduledHours).toBe(expectedHours);
    expect(full.totals.averageTicketCents).toBe(
      Math.round(expectedRevenue / expectedRevenueJobs),
    );
    expect(full.jobs).toHaveLength(JOB_COUNT);
  });

  it("by-team and by-person aggregates conserve the job, hour, and revenue totals", () => {
    // A completed job belongs to exactly one team, so the team rows partition
    // the totals.
    const teamJobs = full.teams.reduce((sum, team) => sum + team.jobs, 0);
    const teamRevenue = full.teams.reduce((sum, team) => sum + (team.revenueCents ?? 0), 0);
    const teamHours = full.teams.reduce((sum, team) => sum + (team.scheduledHours ?? 0), 0);
    expect(teamJobs).toBe(full.totals.jobs);
    expect(teamRevenue).toBe(full.totals.revenueCents);
    expect(teamHours).toBe(full.totals.scheduledHours);

    // Each person's equal share splits the job revenue, so the shares across
    // all people add back up to the full revenue — no cents created or lost.
    const personShare = full.people.reduce(
      (sum, person) => sum + (person.equalShareCents ?? 0),
      0,
    );
    expect(personShare).toBe(full.totals.revenueCents);

    // Every pool member that worked appears exactly once in the person rows.
    expect(full.people.length).toBeGreaterThan(0);
    const labels = full.people.map((person) => person.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("production report paging — parity with the full report", () => {
  function assertSameSummary(page: ProductionReport): void {
    expect(page.from).toBe(full.from);
    expect(page.to).toBe(full.to);
    expect(page.canSeeRevenue).toBe(full.canSeeRevenue);
    expect(page.totals).toEqual(full.totals);
    expect(page.teams).toEqual(full.teams);
    expect(page.people).toEqual(full.people);
  }

  it("carries identical totals/teams/people on every page", () => {
    const pageCount = Math.ceil(full.jobs.length / PRODUCTION_JOBS_PAGE_SIZE);
    for (let page = 1; page <= pageCount; page += 1) {
      assertSameSummary(pageOfProductionReport(full, page));
    }
  });

  it("stitches every page back into the whole jobs list in order", () => {
    const size = PRODUCTION_JOBS_PAGE_SIZE;
    const pageCount = Math.ceil(full.jobs.length / size);
    const stitched: ProductionReport["jobs"] = [];
    for (let page = 1; page <= pageCount; page += 1) {
      const slice = pageOfProductionReport(full, page, size);
      expect(slice.jobsTotal).toBe(full.jobs.length);
      expect(slice.page).toBe(page);
      expect(slice.pageSize).toBe(size);
      expect(slice.jobs.length).toBeLessThanOrEqual(size);
      expect(slice.hasMore).toBe(page < pageCount);
      stitched.push(...slice.jobs);
    }
    expect(stitched).toEqual(full.jobs);
  });

  it("keeps the first payload an order of magnitude smaller than the full report", () => {
    const firstPage = pageOfProductionReport(full, 1);
    expect(firstPage.jobs).toHaveLength(PRODUCTION_JOBS_PAGE_SIZE);
    const fullBytes = JSON.stringify(full).length;
    const pageBytes = JSON.stringify(firstPage).length;
    expect(pageBytes * 10).toBeLessThan(fullBytes);
  });

  it("clamps the page size and handles out-of-range pages", () => {
    const huge = pageOfProductionReport(full, 1, 10_000);
    expect(huge.pageSize).toBe(500);
    expect(huge.jobs).toHaveLength(500);

    const tooSmall = pageOfProductionReport(full, 1, 0);
    expect(tooSmall.pageSize).toBe(1);
    expect(tooSmall.jobs).toHaveLength(1);

    const past = pageOfProductionReport(full, 9_999);
    expect(past.jobs).toHaveLength(0);
    expect(past.hasMore).toBe(false);

    const zeroOrNegative = pageOfProductionReport(full, 0);
    expect(zeroOrNegative.page).toBe(1);
  });
});
