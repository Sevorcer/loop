/**
 * Regression tests: production report source reads at import scale.
 *
 * The report used to send every completed job id (~2,500 after the Service
 * Fusion import) in a single .in("job_id", ids) per related table — a ~90 KB
 * request URL the gateway rejects with a 414, whose HTML body then surfaced
 * on the Reports page as the error message. Even when the URL fit, the reads
 * silently truncated at the 1,000-row PostgREST cap. The reads now chunk ids
 * (80 per request) and page within each chunk.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Hoisted fake Supabase client: in-memory tables, a chainable builder that
// honours eq / in / order / range, and a recorder for every .in() call.
// ---------------------------------------------------------------------------

const harness = vi.hoisted(() => {
  type Row = Record<string, unknown>;

  const state = {
    tables: {} as Record<string, Row[]>,
    errors: {} as Record<string, { code?: string; message: string }>,
    inCalls: [] as Array<{ table: string; column: string; count: number }>,
  };

  function compareValues(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return String(a) < String(b) ? -1 : 1;
  }

  function makeBuilder(table: string) {
    const filters: Array<[string, unknown]> = [];
    let inFilter: [string, unknown[]] | null = null;
    const orders: Array<[string, boolean]> = [];
    let range: [number, number] | null = null;

    function execute(): { data: Row[] | null; error: { code?: string; message: string } | null } {
      const injected = state.errors[table];
      if (injected) return { data: null, error: injected };
      let rows = (state.tables[table] ?? []).filter((row) =>
        filters.every(([column, value]) => row[column] === value),
      );
      if (inFilter) {
        const [column, values] = inFilter;
        const wanted = new Set(values);
        rows = rows.filter((row) => wanted.has(row[column]));
      }
      for (const [column, ascending] of [...orders].reverse()) {
        const direction = ascending ? 1 : -1;
        rows = [...rows].sort((a, b) => compareValues(a[column], b[column]) * direction);
      }
      if (range) rows = rows.slice(range[0], range[1] + 1);
      return { data: rows, error: null };
    }

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        state.inCalls.push({ table, column, count: values.length });
        inFilter = [column, values];
        return builder;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        orders.push([column, options?.ascending !== false]);
        return builder;
      },
      range: (from: number, to: number) => {
        range = [from, to];
        return builder;
      },
      then: (
        onFulfilled: (value: { data: Row[] | null; error: { code?: string; message: string } | null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve().then(execute).then(onFulfilled, onRejected),
    };
    return builder;
  }

  const supabase = { from: (table: string) => makeBuilder(table) };
  const getRepositoryContext = vi.fn(async () => ({ supabase, orgId: "org-test" }));

  return { state, getRepositoryContext };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: harness.getRepositoryContext,
}));

import { listProductionSources } from "@/repositories/productionReport";

const ORG = "org-test";
const JOB_COUNT = 2600;
const ASSIGNEES_PER_JOB = 15;
const USER_COUNT = 40;

function jobId(index: number): string {
  return `job-${String(index).padStart(5, "0")}`;
}

function seedLargeOrg() {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    jobs: [],
    job_activity: [],
    job_assignees: [],
    job_completion_team: [],
    dispatch_plans: [],
    job_financials: [],
    user_profiles: [],
  };

  for (let u = 0; u < USER_COUNT; u += 1) {
    tables.user_profiles.push({
      id: `user-${String(u).padStart(2, "0")}`,
      full_name: `Tech ${String(u).padStart(2, "0")}`,
      email: null,
      org_id: ORG,
    });
  }

  for (let i = 0; i < JOB_COUNT; i += 1) {
    const id = jobId(i);
    tables.jobs.push({
      id,
      job_number: `SF-${i}`,
      status: "Completed",
      title: `Job ${i}`,
      customer_name: "Customer",
      assigned_to: "",
      scheduled_start_at: null,
      scheduled_end_at: null,
      updated_at: "2026-11-01T00:00:00Z",
      org_id: ORG,
    });
    tables.job_activity.push({
      job_id: id,
      created_at: new Date(Date.UTC(2026, 10, 1) + i * 1000).toISOString(),
      org_id: ORG,
      type: "status",
      title: "Job completed",
    });
    // 15 assignees per job: the first 80-job chunk matches 1,200 rows, so
    // reading it in full requires paging past the 1,000-row cap.
    for (let a = 0; a < ASSIGNEES_PER_JOB; a += 1) {
      tables.job_assignees.push({
        job_id: id,
        user_id: `user-${String((i + a) % USER_COUNT).padStart(2, "0")}`,
        org_id: ORG,
      });
    }
    tables.job_completion_team.push(
      { job_id: id, user_id: null, person_name: `Lead ${i}`, org_id: ORG },
      { job_id: id, user_id: null, person_name: `Helper ${i}`, org_id: ORG },
    );
    tables.dispatch_plans.push({ job_id: id, estimated_duration_hours: 5, org_id: ORG });
    tables.job_financials.push({ job_id: id, revenue_cents: 12345, org_id: ORG });
  }

  harness.state.tables = tables;
  harness.state.errors = {};
  harness.state.inCalls = [];
}

describe("listProductionSources at import scale", () => {
  beforeEach(() => {
    seedLargeOrg();
  });

  it("never sends more than a chunk of ids per request and merges every chunk", async () => {
    const { jobs, completions } = await listProductionSources(true);

    expect(harness.state.inCalls.length).toBeGreaterThan(0);
    for (const call of harness.state.inCalls) {
      expect(call.count).toBeLessThanOrEqual(80);
    }

    expect(jobs).toHaveLength(JOB_COUNT);
    expect(completions).toHaveLength(JOB_COUNT);

    // Last job of the first chunk: its assignee rows sit past row 1,000 of
    // that chunk's result, so they only arrive if the read pages.
    const chunkBoundaryJob = jobs[79];
    expect(chunkBoundaryJob.id).toBe(jobId(79));
    expect(chunkBoundaryJob.assignees).toHaveLength(ASSIGNEES_PER_JOB);

    // Final job overall: only reachable if all 33 chunks were read.
    const lastJob = jobs[JOB_COUNT - 1];
    expect(lastJob.id).toBe(jobId(JOB_COUNT - 1));
    expect(lastJob.assignees).toHaveLength(ASSIGNEES_PER_JOB);
    expect(lastJob.assignees[0].name).toMatch(/^Tech \d{2}$/);
    expect(lastJob.completionTeam).toHaveLength(2);
    expect(lastJob.estimatedDurationHours).toBe(5);
    expect(lastJob.revenueCents).toBe(12345);
  });

  it("keeps the missing-relation fallback when a related table is absent", async () => {
    harness.state.errors = {
      job_completion_team: {
        code: "PGRST205",
        message: "Could not find the table 'public.job_completion_team' in the schema cache",
      },
    };

    const { jobs } = await listProductionSources(true);
    expect(jobs).toHaveLength(JOB_COUNT);
    expect(jobs[0].completionTeam).toEqual([]);
    expect(jobs[0].assignees).toHaveLength(ASSIGNEES_PER_JOB);
  });

  it("never surfaces a raw upstream HTML error page as the failure message", async () => {
    harness.state.errors = {
      job_financials: {
        message:
          "<html>\r\n<head><title>414 Request-URI Too Large</title></head>\r\n<body>cloudflare</body>\r\n</html>",
      },
    };

    await expect(listProductionSources(true)).rejects.toThrow("Production report query failed.");
    await expect(listProductionSources(true)).rejects.not.toThrow("414");
  });
});
