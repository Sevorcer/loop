/**
 * Operational reports used to call listJobReportRows() with no options, which
 * defaulted to pageSize 50. The four reports (installs, pipeline, scorecards,
 * callbacks) therefore ignored every job past the 50 newest. This test builds
 * 120 jobs and proves the paged reader returns all of them.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type JobRow = {
  id: string;
  org_id: string;
  job_number: string;
  type: string;
  status: string;
  title: string;
  customer_name: string;
  property_name: string;
  assigned_to: string;
  scheduled_start_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const { fakeSupabase, jobsTable, rangeCalls, inCalls } = vi.hoisted(() => {
  const jobsTable: JobRow[] = [];
  // Size of every `.in(...)` id list sent to the side tables.
  const inCalls: Array<{ table: string; size: number }> = [];
  const rangeCalls: Array<{ from: number; to: number }> = [];

  class FakeQuery {
    private filters: Array<(row: JobRow) => boolean> = [];
    private orderField: string | null = null;
    private ascending = false;
    private from = 0;
    private to = 49;

    select() {
      return this;
    }
    eq(field: keyof JobRow, value: unknown) {
      this.filters.push((row) => row[field] === value);
      return this;
    }
    is(field: keyof JobRow, value: null) {
      this.filters.push((row) => row[field] === value);
      return this;
    }
    order(field: string, options?: { ascending?: boolean }) {
      this.orderField = field;
      this.ascending = options?.ascending ?? true;
      return this;
    }
    range(from: number, to: number) {
      this.from = from;
      this.to = to;
      return this;
    }
    then<T1, T2>(
      onFulfilled?: ((value: { data: JobRow[]; error: null }) => T1) | null,
      onRejected?: ((reason: unknown) => T2) | null,
    ) {
      rangeCalls.push({ from: this.from, to: this.to });
      let rows = jobsTable.filter((row) => this.filters.every((f) => f(row)));
      if (this.orderField) {
        const field = this.orderField as keyof JobRow;
        rows = [...rows].sort((a, b) => {
          const left = String(a[field] ?? "");
          const right = String(b[field] ?? "");
          return this.ascending ? left.localeCompare(right) : right.localeCompare(left);
        });
      }
      const data = rows.slice(this.from, this.to + 1);
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
    }
  }

  const fakeSupabase = {
    from(name: string) {
      if (name === "jobs") return new FakeQuery();
      if (name === "job_assignees" || name === "job_completion_team" || name === "user_profiles") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in(_field: string, values: unknown[]) {
            inCalls.push({ table: name, size: values.length });
            return this;
          },
          order() {
            return this;
          },
          then<T1, T2>(
            onFulfilled?: ((value: { data: []; error: null }) => T1) | null,
            onRejected?: ((reason: unknown) => T2) | null,
          ) {
            return Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
          },
        };
      }
      throw new Error(`unexpected table ${name}`);
    },
  };

  return { fakeSupabase, jobsTable, rangeCalls, inCalls };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: vi.fn().mockResolvedValue({ supabase: fakeSupabase, orgId: "org-1" }),
}));

import { listJobReportRows } from "@/repositories/jobs";

function makeJob(index: number): JobRow {
  const n = String(index).padStart(4, "0");
  return {
    id: `job-${n}`,
    org_id: "org-1",
    job_number: `JOB-${n}`,
    type: index % 5 === 0 ? "Install" : "Service",
    status: "Completed",
    title: `Job ${n}`,
    customer_name: "Customer",
    property_name: "Property",
    assigned_to: "Tech",
    scheduled_start_at: null,
    scheduled_for: `2026-10-${String((index % 28) + 1).padStart(2, "0")}`,
    created_at: `2026-10-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    updated_at: `2026-10-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    deleted_at: null,
  };
}

describe("listJobReportRows paging", () => {
  it("returns more than the old 50-row default by paging through every job", async () => {
    jobsTable.length = 0;
    rangeCalls.length = 0;
    for (let i = 0; i < 120; i += 1) jobsTable.push(makeJob(i));

    const rows = await listJobReportRows();

    expect(rows).toHaveLength(120);
    expect(rows.map((row) => row.id)).toContain("job-0000");
    expect(rows.map((row) => row.id)).toContain("job-0119");
    // One full page of 1000 would be enough for 120 rows; the reader still
    // issues a ranged select (and stops when the page is short).
    expect(rangeCalls.length).toBeGreaterThanOrEqual(1);
    expect(rangeCalls[0]).toEqual({ from: 0, to: 999 });
  });

  it("still supports the legacy single-page options used by older callers", async () => {
    jobsTable.length = 0;
    rangeCalls.length = 0;
    for (let i = 0; i < 80; i += 1) jobsTable.push(makeJob(i));

    const rows = await listJobReportRows(undefined, { page: 1, pageSize: 50 });
    expect(rows).toHaveLength(50);
    expect(rangeCalls).toEqual([{ from: 0, to: 49 }]);
  });

  it("chunks id lists sent to side tables so a full-org report never overflows the URL", async () => {
    jobsTable.length = 0;
    rangeCalls.length = 0;
    inCalls.length = 0;
    for (let i = 0; i < 250; i += 1) jobsTable.push(makeJob(i));

    const rows = await listJobReportRows();

    expect(rows).toHaveLength(250);
    const completionCalls = inCalls.filter((call) => call.table === "job_completion_team");
    expect(completionCalls.length).toBeGreaterThan(1);
    expect(Math.max(...completionCalls.map((call) => call.size))).toBeLessThanOrEqual(80);
    expect(completionCalls.reduce((sum, call) => sum + call.size, 0)).toBe(250);
  });
});
