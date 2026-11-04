/**
 * Dedicated recent-jobs read: jobs repository
 *
 * Regression coverage for item D: the dashboard "Recent Jobs" widget read the
 * WHOLE workspace through the /api/jobs paginator (~thousands of rows) and
 * timed out. listRecentJobs is a purpose-built read — latest N by updated_at,
 * capped SERVER-SIDE with `.limit`.
 *
 * The fake Supabase records the order column and the limit it was handed, and
 * only ever returns `limit` rows, so the test can prove the cap is applied at
 * the query (not by slicing a full fetch) and that the newest rows come first.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const { fakeSupabase, calls } = vi.hoisted(() => {
  const calls: Array<{ orderField: string | null; ascending: boolean; limit: number | null }> = [];

  class FakeQuery {
    private orderField: string | null = null;
    private ascending = true;
    private limitValue: number | null = null;

    constructor(private readonly rows: Row[]) {}

    select(_columns: string) {
      return this;
    }

    eq() {
      return this;
    }

    is() {
      return this;
    }

    order(field: string, options?: { ascending?: boolean }) {
      this.orderField = field;
      this.ascending = options?.ascending ?? true;
      return this;
    }

    limit(value: number) {
      this.limitValue = value;
      return this;
    }

    private execute() {
      calls.push({ orderField: this.orderField, ascending: this.ascending, limit: this.limitValue });
      let rows = [...this.rows];
      if (this.orderField) {
        const field = this.orderField;
        const direction = this.ascending ? 1 : -1;
        rows.sort((a, b) => (String(a[field]) < String(b[field]) ? -direction : direction));
      }
      if (this.limitValue !== null) {
        rows = rows.slice(0, this.limitValue);
      }
      return { data: rows, error: null };
    }

    then<T1, T2>(
      onFulfilled?: ((value: { data: Row[]; error: null }) => T1) | null,
      onRejected?: ((reason: unknown) => T2) | null,
    ) {
      return Promise.resolve(this.execute()).then(onFulfilled, onRejected);
    }
  }

  function jobRow(index: number): Row {
    const label = String(index).padStart(3, "0");
    return {
      id: `job-${label}`,
      job_number: `J-${label}`,
      estimate_id: null,
      equipment_bundle_id: null,
      title: `Job ${label}`,
      type: "Service",
      status: "Scheduled",
      priority: "Medium",
      customer_id: "cust-1",
      customer_name: "Acme",
      property_id: "prop-1",
      property_name: "HQ",
      assigned_to: "",
      contractor_ids: [],
      scheduled_for: null,
      summary: "",
      location: "",
      notes: "",
      created_at: "2026-01-01T00:00:00.000Z",
      // index 0 is the most recently updated.
      updated_at: new Date(Date.parse("2026-11-02T00:00:00.000Z") - index * 60_000).toISOString(),
      appointment_window: 9,
      scheduled_start_at: null,
      scheduled_end_at: null,
      arrival_window_start_at: null,
      arrival_window_end_at: null,
      closeout_mode: "full",
    };
  }

  // 3000 jobs — the workspace size that timed the old widget out.
  const jobsTable: Row[] = Array.from({ length: 3000 }, (_, index) => jobRow(index));

  const fakeSupabase = {
    from(table: string) {
      return new FakeQuery(table === "jobs" ? jobsTable : []);
    },
  };

  return { fakeSupabase, calls };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: vi.fn().mockResolvedValue({
    supabase: fakeSupabase,
    orgId: "org-test",
  }),
}));

import { listRecentJobs } from "@/repositories/jobs";

describe("listRecentJobs", () => {
  it("returns only the latest N jobs, newest first", async () => {
    const jobs = await listRecentJobs(5);
    expect(jobs).toHaveLength(5);
    expect(jobs.map((job) => job.id)).toEqual([
      "job-000",
      "job-001",
      "job-002",
      "job-003",
      "job-004",
    ]);
  });

  it("caps the read SERVER-SIDE with .limit on updated_at desc", async () => {
    calls.length = 0;
    await listRecentJobs(5);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ orderField: "updated_at", ascending: false, limit: 5 });
  });

  it("defaults to 5 when no limit is given", async () => {
    calls.length = 0;
    const jobs = await listRecentJobs();
    expect(jobs).toHaveLength(5);
    expect(calls[0].limit).toBe(5);
  });

  it("clamps the limit to a sane window", async () => {
    calls.length = 0;
    await listRecentJobs(1000);
    expect(calls[0].limit).toBe(50);

    calls.length = 0;
    await listRecentJobs(0);
    expect(calls[0].limit).toBe(1);
  });
});
