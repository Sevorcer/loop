/**
 * Regression tests: the dispatch board dropped almost every job.
 *
 * Half 1 — loadDispatchJobContext read listJobs(), whose default page is
 * the 50 newest jobs, and the board then dropped every plan whose job was
 * not in that page as an "orphan". The context now fetches the jobs the
 * snapshot's plans point at, by id, with no page cap.
 *
 * Half 2 (read side) — loadDispatchSnapshot read each table in a single
 * request; PostgREST truncates at 1,000 rows, so once plans exist for the
 * whole workspace the tail would silently vanish. It now pages, and its
 * job/assignee enrichment reads ids in bounded chunks.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// In-memory Supabase fake: chainable, thenable, honours eq/in filters and
// range windows so paging behaviour is exercised for real.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type QueryCall = { table: string; method: string; args: unknown[] };

const { tables, queryCalls, mockGetRepositoryContext } = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {};
  const queryCalls: QueryCall[] = [];

  function applyFilters(rows: Row[], filters: Array<(row: Row) => boolean>) {
    return rows.filter((row) => filters.every((keep) => keep(row)));
  }

  function applyOrder(
    rows: Row[],
    orders: Array<{ column: string; ascending: boolean }>,
  ) {
    const sorted = [...rows];
    for (const { column, ascending } of [...orders].reverse()) {
      sorted.sort((left, right) => {
        const a = String(left[column] ?? "");
        const b = String(right[column] ?? "");
        const delta = a < b ? -1 : a > b ? 1 : 0;
        return ascending ? delta : -delta;
      });
    }
    return sorted;
  }

  function makeBuilder(table: string) {
    let mode: "select" | "insert" | "update" | "delete" = "select";
    let payload: unknown;
    const filters: Array<(row: Row) => boolean> = [];
    const orders: Array<{ column: string; ascending: boolean }> = [];
    let rangeWindow: { from: number; to: number } | null = null;
    let single = false;

    function execute(): { data: unknown; error: null } {
      const source = tables[table] ?? [];
      if (mode === "insert") {
        const inserted = (Array.isArray(payload) ? payload : [payload]) as Row[];
        tables[table] = [...source, ...inserted];
        return { data: inserted, error: null };
      }
      if (mode === "update") {
        const patch = payload as Row;
        const updated: Row[] = [];
        tables[table] = source.map((row) => {
          if (!filters.every((keep) => keep(row))) return row;
          const next = { ...row, ...patch };
          updated.push(next);
          return next;
        });
        return { data: single ? (updated[0] ?? null) : updated, error: null };
      }
      if (mode === "delete") {
        tables[table] = source.filter(
          (row) => !filters.every((keep) => keep(row)),
        );
        return { data: null, error: null };
      }
      let rows = applyOrder(applyFilters(source, filters), orders);
      if (rangeWindow) rows = rows.slice(rangeWindow.from, rangeWindow.to + 1);
      return { data: single ? (rows[0] ?? null) : rows, error: null };
    }

    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        queryCalls.push({ table, method: "select", args });
        return builder;
      },
      insert: (value: unknown) => {
        mode = "insert";
        payload = value;
        return builder;
      },
      update: (value: unknown) => {
        mode = "update";
        payload = value;
        return builder;
      },
      delete: () => {
        mode = "delete";
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value);
        return builder;
      },
      neq: (column: string, value: unknown) => {
        filters.push((row) => row[column] !== value);
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        queryCalls.push({ table, method: "in", args: [column, values] });
        filters.push((row) => (values as unknown[]).includes(row[column]));
        return builder;
      },
      lte: (column: string, value: unknown) => {
        filters.push(
          (row) => String(row[column] ?? "") <= String(value ?? ""),
        );
        return builder;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        orders.push({ column, ascending: options?.ascending !== false });
        return builder;
      },
      range: (from: number, to: number) => {
        queryCalls.push({ table, method: "range", args: [from, to] });
        rangeWindow = { from, to };
        return builder;
      },
      maybeSingle: () => {
        single = true;
        return builder;
      },
      single: () => {
        single = true;
        return builder;
      },
      then: (
        onFulfilled: (value: { data: unknown; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve().then(() => execute()).then(onFulfilled, onRejected),
    };
    return builder;
  }

  const supabase = {
    from: (table: string) => makeBuilder(table),
  };

  return {
    tables,
    queryCalls,
    mockGetRepositoryContext: vi
      .fn()
      .mockResolvedValue({ supabase, orgId: "org-1" }),
  };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: mockGetRepositoryContext,
}));

import { assembleDispatchSnapshot } from "@/features/dispatch/utils/dispatchUtils";
import { loadDispatchSnapshot } from "@/repositories/dispatch";
import { loadDispatchJobContext } from "@/services/dispatch";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function jobRow(index: number): Row {
  const day = String((index % 28) + 1).padStart(2, "0");
  return {
    id: `job-${index}`,
    org_id: "org-1",
    job_number: `JOB-${1000 + index}`,
    estimate_id: null,
    equipment_bundle_id: null,
    title: `Job ${index}`,
    type: "Install",
    status: "Scheduled",
    priority: "Medium",
    customer_id: `cust-${index}`,
    customer_name: `Customer ${index}`,
    property_id: `prop-${index}`,
    property_name: `Property ${index}`,
    assigned_to: "",
    contractor_ids: index === 3 ? ["contractor-1"] : [],
    scheduled_for: `2026-11-${day}`,
    appointment_window: null,
    scheduled_start_at: `2026-11-${day}T15:00:00.000Z`,
    scheduled_end_at: `2026-11-${day}T19:00:00.000Z`,
    arrival_window_start_at: null,
    arrival_window_end_at: null,
    closeout_mode: "full",
    summary: "",
    location: "",
    notes: "",
    // Newest first: job-1 is the most recently created job.
    created_at: new Date(Date.UTC(2026, 10, 2) - index * 60_000).toISOString(),
  };
}

function planRow(index: number): Row {
  return {
    id: `plan-${index}`,
    org_id: "org-1",
    job_id: `job-${index}`,
    job_number: `JOB-${1000 + index}`,
    customer_name: `Customer ${index}`,
    property_name: `Property ${index}`,
    job_type: "Install",
    dispatch_status: "scheduled",
    dispatchability: {},
    target_date: "2026-11-05",
    estimated_duration_hours: 4,
    priority: "normal",
    sequencing_notes: null,
    constraints: [],
    created_at: new Date(Date.UTC(2026, 10, 2) - index * 60_000).toISOString(),
    updated_at: "2026-11-02T00:00:00.000Z",
  };
}

// ---------------------------------------------------------------------------

describe("dispatch board job context (50-row join regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(tables)) delete tables[key];
    queryCalls.length = 0;
    tables.jobs = Array.from({ length: 60 }, (_, i) => jobRow(i + 1));
    tables.dispatch_plans = Array.from({ length: 60 }, (_, i) => planRow(i + 1));
    tables.contractors = [
      {
        id: "contractor-1",
        company_name: "Acme Subs",
        contact_name: "",
        email: "",
        phone: "",
        trade: "",
        active: true,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    tables.job_assignees = [];
  });

  it("loads the jobs for every plan, not just the 50 newest jobs", async () => {
    const snapshot = await loadDispatchSnapshot();
    const context = await loadDispatchJobContext(snapshot.plans);

    expect(context.jobs).toHaveLength(60);
    expect(context.jobIds).toContain("job-60");
    // The contractor map only exists for jobs the context actually loaded.
    expect(context.jobContractorIds["job-3"]).toEqual(["contractor-1"]);
  });

  it("keeps every plan when the board filters plans against the context", async () => {
    const snapshot = await loadDispatchSnapshot();
    const context = await loadDispatchJobContext(snapshot.plans);

    const assembled = assembleDispatchSnapshot(
      snapshot.plans,
      snapshot.assignments,
      snapshot.scheduleBlocks,
      snapshot.events,
      snapshot.crews,
      new Set(context.jobIds),
    );

    expect(assembled.dispatchPlans).toHaveLength(60);
    expect(assembled.metrics.totalPlans).toBe(60);
  });

  it("still drops a plan whose job was really deleted", async () => {
    const plans = [
      ...Array.from({ length: 60 }, (_, i) => planRow(i + 1)),
      { ...planRow(999), id: "plan-orphan", job_id: "job-deleted" },
    ];
    const context = await loadDispatchJobContext(
      plans.map((plan) => ({
        jobId: plan.job_id as string,
      })),
    );

    const validJobIds = new Set(context.jobIds);
    const kept = plans.filter(
      (plan) => !plan.job_id || validJobIds.has(plan.job_id as string),
    );

    expect(kept).toHaveLength(60);
    expect(kept.some((plan) => plan.id === "plan-orphan")).toBe(false);
  });
});

describe("dispatch snapshot read at workspace scale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(tables)) delete tables[key];
    queryCalls.length = 0;
    tables.jobs = Array.from({ length: 3 }, (_, i) => jobRow(i + 1));
    tables.crews = [];
    tables.crew_assignments = [];
    tables.schedule_blocks = [];
    tables.dispatch_events = [];
    tables.job_assignees = [];
    tables.user_profiles = [];
  });

  it("pages past the 1,000-row PostgREST cap instead of truncating plans", async () => {
    tables.dispatch_plans = Array.from({ length: 1005 }, (_, i) =>
      planRow(i + 1),
    );

    const snapshot = await loadDispatchSnapshot();

    expect(snapshot.plans).toHaveLength(1005);
    const planRanges = queryCalls.filter(
      (call) => call.table === "dispatch_plans" && call.method === "range",
    );
    expect(planRanges.length).toBeGreaterThanOrEqual(2);
  });

  it("reads job enrichment ids in bounded chunks", async () => {
    tables.dispatch_plans = Array.from({ length: 1005 }, (_, i) =>
      planRow(i + 1),
    );
    tables.jobs = Array.from({ length: 1005 }, (_, i) => jobRow(i + 1));
    tables.job_assignees = [
      {
        job_id: "job-1005",
        user_id: "user-1",
        org_id: "org-1",
        created_at: "2026-11-01T00:00:00.000Z",
      },
    ];
    tables.user_profiles = [
      { id: "user-1", full_name: "Pat Tech", email: "pat@example.com" },
    ];

    const snapshot = await loadDispatchSnapshot();

    const jobIdIns = queryCalls.filter(
      (call) => call.table === "jobs" && call.method === "in",
    );
    expect(jobIdIns.length).toBeGreaterThan(1);
    for (const call of jobIdIns) {
      expect((call.args[1] as unknown[]).length).toBeLessThanOrEqual(80);
    }

    const enriched = snapshot.plans.find((plan) => plan.jobId === "job-1005");
    expect(enriched?.scheduledStartAt).toBeTruthy();
    expect(enriched?.assignedTechNames).toEqual(["Pat Tech"]);
  });
});
