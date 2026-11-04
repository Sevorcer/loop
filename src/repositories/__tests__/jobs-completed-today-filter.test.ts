/**
 * "Completed today" list filter — jobs repository.
 *
 * The Dashboard tile's count (commandCenter) is the union of two signals:
 * a "Job completed" status activity recorded today (preferred), and the
 * fallback of Completed jobs whose updated_at is today. The jobs list
 * behind the tile link must return that same union — a job completed via
 * the activity signal whose updated_at drifted must still appear, and a
 * job merely edited today must not be double-counted (it appears once).
 *
 * The fake Supabase below actually applies the filters it is handed
 * (eq / gte / or), so the test proves the union semantics, not just the
 * query shape.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const { fakeSupabase } = vi.hoisted(() => {
  const TODAY = "2026-11-04";
  const YESTERDAY = "2026-11-03T17:00:00.000Z";

  function jobRow(overrides: Row): Row {
    return {
      id: "job-x",
      job_number: "J-X",
      estimate_id: null,
      equipment_bundle_id: null,
      title: "Job",
      type: "Service",
      status: "Completed",
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
      updated_at: YESTERDAY,
      appointment_window: 9,
      scheduled_start_at: null,
      scheduled_end_at: null,
      arrival_window_start_at: null,
      arrival_window_end_at: null,
      closeout_mode: "full",
      ...overrides,
    };
  }

  const jobsTable: Row[] = [
    // Completed via activity today; updated_at is yesterday (drifted).
    jobRow({ id: "job-activity", updated_at: YESTERDAY }),
    // Completed and updated today; no activity row.
    jobRow({ id: "job-updated", updated_at: `${TODAY}T18:00:00.000Z` }),
    // Completed yesterday, untouched today, no activity.
    jobRow({ id: "job-stale", updated_at: YESTERDAY }),
    // Updated today but not Completed.
    jobRow({ id: "job-open", status: "Scheduled", updated_at: `${TODAY}T18:00:00.000Z` }),
  ];

  const activityTable: Row[] = [
    {
      job_id: "job-activity",
      type: "status",
      title: "Job completed",
      created_at: `${TODAY}T18:30:00.000Z`,
    },
  ];

  class FakeQuery {
    private filters: Array<(row: Row) => boolean> = [];
    private countOnly = false;

    constructor(private readonly rows: Row[]) {}

    select(_columns: string, options?: { count?: string; head?: boolean }) {
      this.countOnly = Boolean(options?.head);
      return this;
    }

    eq(column: string, value: unknown) {
      // org_id is not a row field in this fake; treat it as always matching.
      if (column !== "org_id") {
        this.filters.push((row) => row[column] === value);
      }
      return this;
    }

    in(column: string, values: unknown[]) {
      this.filters.push((row) => values.includes(row[column]));
      return this;
    }

    ilike() {
      return this;
    }

    gte(column: string, value: string) {
      this.filters.push((row) => String(row[column] ?? "") >= value);
      return this;
    }

    is(column: string, value: unknown) {
      this.filters.push((row) => (row[column] ?? null) === value);
      return this;
    }

    or(expression: string) {
      // Shape used by the completed-date filter:
      // "updated_at.gte.<date>,id.in.(<id>,<id>)"
      const gteMatch = /updated_at\.gte\.([^,]+)/.exec(expression);
      const inMatch = /id\.in\.\(([^)]*)\)/.exec(expression);
      const date = gteMatch?.[1] ?? "";
      const ids = inMatch ? inMatch[1].split(",").filter(Boolean) : [];
      this.filters.push(
        (row) => String(row.updated_at ?? "") >= date || ids.includes(String(row.id)),
      );
      return this;
    }

    order() {
      return this;
    }

    range(from: number, to: number) {
      this.filters.push((() => {
        let seen = -1;
        return () => {
          seen += 1;
          return seen >= from && seen <= to;
        };
      })());
      return this;
    }

    private execute() {
      const rows = this.rows.filter((row) => this.filters.every((f) => f(row)));
      if (this.countOnly) {
        return { data: null, error: null, count: rows.length };
      }
      return { data: rows, error: null, count: rows.length };
    }

    then<T1, T2>(
      onFulfilled?: ((value: { data: Row[] | null; error: null; count: number }) => T1) | null,
      onRejected?: ((reason: unknown) => T2) | null,
    ) {
      return Promise.resolve(this.execute()).then(onFulfilled, onRejected);
    }
  }

  const fakeSupabase = {
    from(table: string) {
      return new FakeQuery(table === "jobs" ? jobsTable : table === "job_activity" ? activityTable : []);
    },
  };

  return { fakeSupabase };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: vi.fn().mockResolvedValue({
    supabase: fakeSupabase,
    orgId: "org-test",
  }),
}));

import { listJobsPaginated } from "@/repositories/jobs";

describe("listJobsPaginated — completedDate union filter", () => {
  it("returns the union of activity-signalled and updated-today completions", async () => {
    const result = await listJobsPaginated({
      status: "Completed",
      completedDate: "2026-11-04",
    });

    const ids = result.jobs.map((job) => job.id).sort();
    expect(ids).toEqual(["job-activity", "job-updated"]);
    expect(result.total).toBe(2);
  });

  it("without completedDate, no completion filtering applies", async () => {
    const result = await listJobsPaginated({ status: "Completed" });
    const ids = result.jobs.map((job) => job.id).sort();
    expect(ids).toEqual(["job-activity", "job-stale", "job-updated"]);
  });
});
