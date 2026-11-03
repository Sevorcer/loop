/**
 * Callback counts agree across surfaces (Task 10).
 *
 * The Dashboard ("Open callbacks") and the Command Center callback panel must
 * both count by job TYPE === "Callback" with status open (not Completed /
 * Cancelled) — never by matching the word "callback" in the title or notes,
 * which was the Command Center bug that produced a figure matching no other
 * screen.
 *
 * A single in-memory fixture backs both repositories. It contains:
 *   • 3 OPEN callbacks (incl. one lowercase "callback" type variant),
 *   • 2 closed callbacks (Completed + Cancelled),
 *   • 1 DECOY Service job whose title is "Callback follow-up" (must NOT count),
 *   • 1 unrelated Install job.
 * So: open callbacks = 3, all callbacks = 5.
 *
 * The fake Supabase applies the real PostgREST filters the repositories issue,
 * so the counts are produced by the queries under test, and it records every
 * `.or(...)` against the jobs table to prove no title/notes keyword match is
 * used any more.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const { fakeSupabase, jobOrFilters } = vi.hoisted(() => {
  const jobOrFilters: string[] = [];

  const EXCLUSION_LIST = (raw: string): string[] =>
    raw.replace(/^\(|\)$/g, "").split(",").map((s) => s.trim());

  function ilikeToRegExp(pattern: string): RegExp {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const body = escaped.replace(/%/g, ".*").replace(/_/g, ".");
    return new RegExp(`^${body}$`, "i");
  }

  function matchClause(row: Row, clause: string): boolean {
    // "col.op.val" — op is is | eq | ilike (the forms the repos emit)
    const firstDot = clause.indexOf(".");
    const col = clause.slice(0, firstDot);
    const rest = clause.slice(firstDot + 1);
    const secondDot = rest.indexOf(".");
    const op = rest.slice(0, secondDot);
    const val = rest.slice(secondDot + 1);
    const cell = row[col];
    if (op === "is") return val === "null" ? cell == null : false;
    if (op === "eq") return String(cell ?? "") === val;
    if (op === "ilike") return ilikeToRegExp(val).test(String(cell ?? ""));
    return false;
  }

  class FakeQuery {
    private preds: Array<(row: Row) => boolean> = [];
    private head = false;
    private wantCount = false;

    constructor(private readonly table: string, private readonly rows: Row[]) {}

    select(_columns?: string, options?: { count?: string; head?: boolean }) {
      if (options?.head) this.head = true;
      if (options?.count) this.wantCount = true;
      return this;
    }
    eq(col: string, val: unknown) {
      this.preds.push((row) => row[col] === val);
      return this;
    }
    neq(col: string, val: unknown) {
      this.preds.push((row) => row[col] !== val);
      return this;
    }
    in(col: string, values: readonly unknown[]) {
      this.preds.push((row) => values.includes(row[col]));
      return this;
    }
    not(col: string, op: string, val: string) {
      if (op === "in") {
        const list = EXCLUSION_LIST(val);
        this.preds.push((row) => !list.includes(String(row[col])));
      }
      return this;
    }
    or(filter: string) {
      if (this.table === "jobs") jobOrFilters.push(filter);
      const clauses = filter.split(",");
      this.preds.push((row) => clauses.some((clause) => matchClause(row, clause)));
      return this;
    }
    ilike(col: string, pattern: string) {
      const re = ilikeToRegExp(pattern);
      this.preds.push((row) => re.test(String(row[col] ?? "")));
      return this;
    }
    lt(col: string, val: string) {
      this.preds.push((row) => row[col] != null && String(row[col]) < val);
      return this;
    }
    gte(col: string, val: string) {
      this.preds.push((row) => row[col] != null && String(row[col]) >= val);
      return this;
    }
    order() {
      return this;
    }

    private execute() {
      const matched = this.rows.filter((row) => this.preds.every((p) => p(row)));
      if (this.head) return { data: null, count: matched.length, error: null };
      return { data: matched, count: this.wantCount ? matched.length : null, error: null };
    }
    then<T1, T2>(
      onFulfilled?: ((value: ReturnType<FakeQuery["execute"]>) => T1) | null,
      onRejected?: ((reason: unknown) => T2) | null,
    ) {
      return Promise.resolve(this.execute()).then(onFulfilled, onRejected);
    }
  }

  function job(partial: Partial<Row>): Row {
    return {
      org_id: "org-test",
      id: String(partial.id),
      job_number: String(partial.id),
      estimate_id: null,
      equipment_bundle_id: null,
      title: "",
      type: "Service",
      status: "Scheduled",
      priority: "Medium",
      customer_id: null,
      customer_name: "Acme",
      property_id: null,
      property_name: "HQ",
      assigned_to: "Tech A",
      scheduled_for: null,
      summary: "",
      location: "",
      notes: "",
      created_at: "2020-01-01T00:00:00.000Z",
      updated_at: "2020-01-01T00:00:00.000Z",
      ...partial,
    };
  }

  const jobsTable: Row[] = [
    job({ id: "cb-open-1", type: "Callback", status: "Scheduled", title: "AC not cooling" }),
    job({ id: "cb-open-2", type: "Callback", status: "In Progress", title: "Return visit" }),
    job({ id: "cb-open-3", type: "callback", status: "On Hold", title: "Thermostat" }),
    job({ id: "cb-done-1", type: "Callback", status: "Completed", title: "Fixed" }),
    job({ id: "cb-done-2", type: "Callback", status: "Cancelled", title: "No-show" }),
    // DECOY: title contains "callback" but the job is a Service job.
    job({ id: "decoy", type: "Service", status: "Scheduled", title: "Callback follow-up", notes: "callback" }),
    job({ id: "install", type: "Install", status: "Scheduled", title: "New system" }),
  ];

  const fakeSupabase = {
    from(table: string) {
      if (table === "jobs") return new FakeQuery(table, jobsTable);
      return new FakeQuery(table, []); // job_activity, customers, properties, dispatch_plans, job_assignees …
    },
  };

  return { fakeSupabase, jobOrFilters };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: vi.fn().mockResolvedValue({
    supabase: fakeSupabase,
    orgId: "org-test",
  }),
}));

import { getDashboardSummary } from "@/repositories/dashboard";
import { getCommandCenterSnapshot } from "@/repositories/commandCenter";
import { isOpenCallbackJob } from "@/lib/callbacks";

describe("callback counts across surfaces", () => {
  it("Dashboard 'Open callbacks' counts type Callback AND open — ignoring the title decoy", async () => {
    const summary = await getDashboardSummary();
    expect(summary.openCallbacks).toBe(3);
  });

  it("Command Center callback panel counts open callbacks by type, not title/notes text", async () => {
    const snapshot = await getCommandCenterSnapshot();

    // Exactly the 3 open callbacks, by type; the Service decoy is excluded.
    expect(snapshot.callbacks).toHaveLength(3);
    expect(snapshot.callbacks.every((job) => isOpenCallbackJob(job))).toBe(true);
    expect(snapshot.callbacks.map((job) => job.id).sort()).toEqual([
      "cb-open-1",
      "cb-open-2",
      "cb-open-3",
    ]);
    expect(snapshot.callbacks.some((job) => job.id === "decoy")).toBe(false);

    // The KPI tile reads straight off the same list.
    expect(snapshot.kpis.callbacks).toBe(3);
  });

  it("no surface matches callbacks by title/notes keyword any more", async () => {
    jobOrFilters.length = 0;
    await getCommandCenterSnapshot();
    await getDashboardSummary();
    // The only `.or` on jobs is the unassigned filter; none touches title/notes.
    expect(jobOrFilters.some((f) => /title|notes|callback/i.test(f))).toBe(false);
  });
});
