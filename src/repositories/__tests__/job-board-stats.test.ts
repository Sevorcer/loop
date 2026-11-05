/**
 * Jobs page stat cards — database counts (Bundle C perf fix 1).
 *
 * The Jobs page used to download every job into the browser (15 sequential
 * pages, capped at 3,000) only to count them. countJobBoardStats asks the
 * database for four head-only exact counts instead. The fake Supabase below
 * applies the same filters PostgREST would and records every call, so the
 * test proves: (1) no rows are fetched (head: true, count: exact), (2) the
 * counts match summarizeJobBoard on the same data, including stored status
 * casing variants and soft-deleted rows, and (3) totals above 3,000 are exact.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = { status: string; priority: string; deleted_at: string | null; org_id: string };

const { fakeSupabase, calls, table } = vi.hoisted(() => {
  const calls: Array<{ head: boolean; count: string | undefined }> = [];
  const table: Row[] = [];

  class FakeCountQuery {
    private filters: Array<(row: Row) => boolean> = [];
    constructor(private readonly options: { head?: boolean; count?: string }) {}
    eq(column: keyof Row, value: string) {
      this.filters.push((row) => row[column] === value);
      return this;
    }
    is(column: keyof Row, value: null) {
      this.filters.push((row) => row[column] === value);
      return this;
    }
    in(column: keyof Row, values: string[]) {
      this.filters.push((row) => values.includes(String(row[column])));
      return this;
    }
    ilike(column: keyof Row, pattern: string) {
      this.filters.push((row) => String(row[column]).toLowerCase() === pattern.toLowerCase());
      return this;
    }
    then<T1, T2>(
      onFulfilled?: ((value: { data: null; count: number; error: null }) => T1) | null,
      onRejected?: ((reason: unknown) => T2) | null,
    ) {
      calls.push({ head: Boolean(this.options.head), count: this.options.count });
      const count = table.filter((row) => this.filters.every((f) => f(row))).length;
      return Promise.resolve({ data: null, count, error: null }).then(onFulfilled, onRejected);
    }
  }

  const fakeSupabase = {
    from(name: string) {
      if (name !== "jobs") throw new Error(`unexpected table ${name}`);
      return {
        select(_columns: string, options: { head?: boolean; count?: string }) {
          return new FakeCountQuery(options ?? {});
        },
      };
    },
  };
  return { fakeSupabase, calls, table };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: vi.fn().mockResolvedValue({ supabase: fakeSupabase, orgId: "org-1" }),
}));

import { countJobBoardStats } from "@/repositories/jobs";
import { summarizeJobBoard } from "@/features/jobs/utils/jobBoardStats";

function row(status: string, priority = "Medium", deleted = false, org = "org-1"): Row {
  return { status, priority, deleted_at: deleted ? "2026-11-01T00:00:00Z" : null, org_id: org };
}

describe("countJobBoardStats", () => {
  it("counts in the database with head-only exact counts and matches summarizeJobBoard", async () => {
    table.length = 0;
    calls.length = 0;
    // Production shape: 3,530 Completed, 117 Cancelled, 62 Scheduled,
    // 6 In Progress, 2 On Hold, one High priority — more than the old 3,000 cap.
    table.push(
      ...Array.from({ length: 3530 }, () => row("Completed")),
      ...Array.from({ length: 117 }, () => row("Cancelled")),
      ...Array.from({ length: 61 }, () => row("Scheduled")),
      row("Scheduled", "High"),
      ...Array.from({ length: 5 }, () => row("In Progress")),
      row("in_progress", "high"),
      ...Array.from({ length: 2 }, () => row("On Hold")),
      // Not counted: soft-deleted and another org.
      row("Scheduled", "High", true),
      row("In Progress", "High", false, "org-2"),
    );

    const stats = await countJobBoardStats();
    const visible = table.filter((r) => r.org_id === "org-1" && r.deleted_at === null);

    expect(stats).toEqual(summarizeJobBoard(visible));
    expect(stats).toEqual({ total: 3717, inProgress: 6, scheduled: 62, highPriority: 2 });
    expect(calls).toHaveLength(4);
    expect(calls.every((c) => c.head && c.count === "exact")).toBe(true);
  });
});
