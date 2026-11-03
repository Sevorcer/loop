import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildImportPlan, type PlanInput } from "../plan";

const MIGRATION = path.join(
  process.cwd(),
  "supabase/migrations/20261105000000_sf_import_completion_activity.sql",
);

/**
 * The import function backdates a "Job completed" activity event to the real
 * Service Fusion completion time. The TS plan carries that time on each job as
 * `completed_at`; the SQL function turns it into the job_activity row the
 * dashboards prefer. These tests cover both halves.
 */

function planWithJobs(jobs: unknown[]): PlanInput {
  return {
    customers: [
      {
        id: 2,
        customer_name: "Lot 10",
        contacts: [{ fname: "Ada", lname: "Owner", is_primary: true, phones: [], emails: [] }],
        locations: [
          { street_1: "10 Maple Street", city: "Seattle", state_prov: "WA", postal_code: "98101", is_primary: true },
        ],
      },
    ],
    jobs,
    estimates: [],
    invoices: [],
    equipment: [],
    calendarTasks: [],
    techs: [],
    profiles: [],
    options: { asOfDate: "2026-11-01", staleOpenDays: 60 },
  };
}

describe("import completion activity — plan completed_at", () => {
  it("carries the real Service Fusion completion time for a completed job", () => {
    const plan = buildImportPlan(
      planWithJobs([
        {
          id: 100,
          number: "5001",
          customer_id: 2,
          // "Paid in Full" is a Service Fusion closed status that maps to Completed.
          status: "Paid in Full",
          start_date: "2025-01-15",
          category: "Service - Maintenance",
          updated_at: "2025-02-10T15:00:00Z",
        },
      ]),
    );
    const job = plan.jobs.find((row) => row.sf_id === 100);
    expect(job?.status).toBe("Completed");
    expect(job?.completed_at).toBe("2025-02-10T15:00:00.000Z");
  });

  it("emits no completion time for a non-completed job, even with an updated_at", () => {
    const plan = buildImportPlan(
      planWithJobs([
        {
          id: 102,
          number: "2",
          customer_id: 2,
          status: "Scheduled - Service",
          start_date: "2026-10-01",
          category: "Install",
          updated_at: "2026-10-05T12:00:00Z",
        },
      ]),
    );
    const job = plan.jobs.find((row) => row.sf_id === 102);
    expect(job?.status).toBe("Scheduled");
    expect(job?.completed_at).toBeNull();
  });

  it("never fabricates a date: a completed job without updated_at carries none", () => {
    const plan = buildImportPlan(
      planWithJobs([
        {
          id: 101,
          number: "1",
          customer_id: 2,
          status: "Paid in Full",
          start_date: "2025-01-15",
          category: "Service - Maintenance",
          // no updated_at
        },
      ]),
    );
    const job = plan.jobs.find((row) => row.sf_id === 101);
    expect(job?.status).toBe("Completed");
    expect(job?.completed_at).toBeNull();
  });
});

describe("import completion activity — migration function", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("emits the native completion signal dated to the real SF time, not now()", () => {
    // Same shape native completion writes (src/services/jobs.ts): type 'status',
    // title 'Job completed'.
    expect(sql).toContain("'status', 'Job completed'");
    // Dated to the real Service Fusion completion time carried on the batch.
    expect(sql).toContain("r.completed_at");
    // Only for completed jobs that actually have a timestamp — no fabrication.
    expect(sql).toContain("r.status = 'Completed'");
    expect(sql).toContain("r.completed_at IS NOT NULL");
  });

  it("is idempotent: a re-import adds no duplicate completion event", () => {
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain("existing.title = 'Job completed'");
  });

  it("leaves the jobs upsert stamping updated_at = now()", () => {
    expect(sql).toContain("updated_at = now()");
  });
});
