/**
 * The dispatch board window: the board page used to load the full org-wide
 * snapshot — every dispatch plan ever made (3,600+ rows, 3,531 of them
 * completed history back to 2024), plus all assignments, blocks, and events
 * — and sat on its loading state for minutes.
 *
 * The windowed snapshot keeps what a working board needs: every active
 * plan (any dispatch_status other than completed/cancelled, any date) and
 * completed plans from the last 7 days. The window rides on the Supabase
 * queries themselves, and plan-child tables are scoped to the windowed
 * plans. The unwindowed read (customer timeline, snapshot API) is
 * unchanged.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/services/inventoryReservations", () => ({ releaseAndRecheck: vi.fn(async () => undefined) }));

// ---------------------------------------------------------------------------
// In-memory Supabase fake: chainable, thenable, honours eq/not/in/gte
// filters and range windows, and records filter calls so the query shape
// itself can be asserted.
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
    const filters: Array<(row: Row) => boolean> = [];
    const orders: Array<{ column: string; ascending: boolean }> = [];
    let rangeWindow: { from: number; to: number } | null = null;

    function execute(): { data: unknown; error: null } {
      let rows = applyOrder(applyFilters(tables[table] ?? [], filters), orders);
      if (rangeWindow) rows = rows.slice(rangeWindow.from, rangeWindow.to + 1);
      return { data: rows, error: null };
    }

    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        queryCalls.push({ table, method: "select", args });
        return builder;
      },
      eq: (column: string, value: unknown) => {
        queryCalls.push({ table, method: "eq", args: [column, value] });
        filters.push((row) => row[column] === value);
        return builder;
      },
      not: (column: string, operator: string, value: unknown) => {
        queryCalls.push({ table, method: "not", args: [column, operator, value] });
        if (operator === "in") {
          const values = String(value)
            .replace(/^\(|\)$/g, "")
            .split(",");
          filters.push((row) => !values.includes(String(row[column] ?? "")));
        }
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        queryCalls.push({ table, method: "in", args: [column, values] });
        filters.push((row) => (values as unknown[]).includes(row[column]));
        return builder;
      },
      gte: (column: string, value: unknown) => {
        queryCalls.push({ table, method: "gte", args: [column, value] });
        filters.push(
          (row) => String(row[column] ?? "") >= String(value ?? ""),
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

import { addCalendarDays, todayInCompanyTimeZone } from "@/lib/timezone";
import { loadDispatchSnapshot, loadDispatchDataForJobs } from "@/repositories/dispatch";
import { loadBoardDispatchSnapshot } from "@/services/dispatch";

// ---------------------------------------------------------------------------
// Fixtures — dates are relative to today in the company timezone so the
// window boundaries hold on any run date.
// ---------------------------------------------------------------------------

const today = todayInCompanyTimeZone();
const cutoff = addCalendarDays(today, -7);

function planRow(id: string, status: string, targetDate: string): Row {
  return {
    id,
    org_id: "org-1",
    job_id: `job-${id}`,
    job_number: `JOB-${id}`,
    customer_name: `Customer ${id}`,
    property_name: `Property ${id}`,
    job_type: "Install",
    dispatch_status: status,
    dispatchability: {},
    target_date: targetDate,
    estimated_duration_hours: 4,
    priority: "normal",
    sequencing_notes: null,
    constraints: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const PLAN_IDS = {
  oldCompleted: "plan-old-completed",
  recentCompleted: "plan-recent-completed",
  edgeCompleted: "plan-edge-completed",
  oldScheduled: "plan-old-scheduled",
  oldInProgress: "plan-old-in-progress",
  futureScheduled: "plan-future-scheduled",
  recentCancelled: "plan-recent-cancelled",
} as const;

const WINDOWED_PLAN_IDS = [
  PLAN_IDS.recentCompleted,
  PLAN_IDS.edgeCompleted,
  PLAN_IDS.oldScheduled,
  PLAN_IDS.oldInProgress,
  PLAN_IDS.futureScheduled,
];

function seedTables() {
  const plans = [
    planRow(PLAN_IDS.oldCompleted, "completed", addCalendarDays(today, -30)),
    planRow(PLAN_IDS.recentCompleted, "completed", addCalendarDays(today, -2)),
    planRow(PLAN_IDS.edgeCompleted, "completed", cutoff),
    planRow(PLAN_IDS.oldScheduled, "scheduled", addCalendarDays(today, -30)),
    planRow(PLAN_IDS.oldInProgress, "in_progress", addCalendarDays(today, -45)),
    planRow(PLAN_IDS.futureScheduled, "scheduled", addCalendarDays(today, 30)),
    planRow(PLAN_IDS.recentCancelled, "cancelled", addCalendarDays(today, -2)),
  ];
  tables.dispatch_plans = plans;
  tables.jobs = plans.map((plan) => ({
    id: plan.job_id,
    title: `Job ${plan.id}`,
    scheduled_start_at: null,
  }));
  tables.crews = [
    {
      id: "crew-1",
      org_id: "org-1",
      name: "Crew 1",
      lead_installer: "Lead",
      members: [],
      certifications: [],
      availability: "available",
    },
  ];
  tables.crew_assignments = [
    {
      id: "assign-old-completed",
      org_id: "org-1",
      dispatch_plan_id: PLAN_IDS.oldCompleted,
      job_id: `job-${PLAN_IDS.oldCompleted}`,
      crew_id: "crew-1",
      crew_name: "Crew 1",
      lead_installer: "Lead",
      supporting_technicians: [],
      status: "confirmed",
      assigned_at: "2026-01-01T00:00:00.000Z",
      reassignment_history: [],
    },
    {
      id: "assign-recent-completed",
      org_id: "org-1",
      dispatch_plan_id: PLAN_IDS.recentCompleted,
      job_id: `job-${PLAN_IDS.recentCompleted}`,
      crew_id: "crew-1",
      crew_name: "Crew 1",
      lead_installer: "Lead",
      supporting_technicians: [],
      status: "confirmed",
      assigned_at: "2026-01-01T00:00:00.000Z",
      reassignment_history: [],
    },
    {
      id: "assign-old-scheduled",
      org_id: "org-1",
      dispatch_plan_id: PLAN_IDS.oldScheduled,
      job_id: `job-${PLAN_IDS.oldScheduled}`,
      crew_id: "crew-1",
      crew_name: "Crew 1",
      lead_installer: "Lead",
      supporting_technicians: [],
      status: "confirmed",
      assigned_at: "2026-01-01T00:00:00.000Z",
      reassignment_history: [],
    },
  ];
  tables.schedule_blocks = [
    {
      id: "block-old-completed",
      org_id: "org-1",
      dispatch_plan_id: PLAN_IDS.oldCompleted,
      job_id: `job-${PLAN_IDS.oldCompleted}`,
      crew_assignment_id: "assign-old-completed",
      crew_name: "Crew 1",
      scheduled_date: addCalendarDays(today, -30),
      scheduled_start_time: "08:00",
      scheduled_end_time: "12:00",
      estimated_duration_hours: 4,
      job_type: "Install",
      customer_name: "Customer",
      property_name: "Property",
      dispatch_status: "completed",
    },
    {
      id: "block-old-scheduled",
      org_id: "org-1",
      dispatch_plan_id: PLAN_IDS.oldScheduled,
      job_id: `job-${PLAN_IDS.oldScheduled}`,
      crew_assignment_id: "assign-old-scheduled",
      crew_name: "Crew 1",
      scheduled_date: addCalendarDays(today, -30),
      scheduled_start_time: "08:00",
      scheduled_end_time: "12:00",
      estimated_duration_hours: 4,
      job_type: "Install",
      customer_name: "Customer",
      property_name: "Property",
      dispatch_status: "scheduled",
    },
  ];
  tables.dispatch_events = [
    {
      id: "event-old-completed",
      org_id: "org-1",
      dispatch_plan_id: PLAN_IDS.oldCompleted,
      type: "job_scheduled",
      timestamp: "2026-01-01T00:00:00.000Z",
      description: "Old completion event",
      metadata: null,
    },
    {
      id: "event-recent-completed",
      org_id: "org-1",
      dispatch_plan_id: PLAN_IDS.recentCompleted,
      type: "job_scheduled",
      timestamp: "2026-01-02T00:00:00.000Z",
      description: "Recent completion event",
      metadata: null,
    },
  ];
  tables.job_assignees = [];
  tables.user_profiles = [];
}

// ---------------------------------------------------------------------------

describe("dispatch board window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(tables)) delete tables[key];
    queryCalls.length = 0;
    seedTables();
  });

  it("keeps active plans of any date and only the last 7 days of completions", async () => {
    const snapshot = await loadDispatchSnapshot({
      boardWindow: { completedSince: cutoff },
    });

    const planIds = snapshot.plans.map((plan) => plan.id);
    // A completed plan from 30 days ago is history — off the board.
    expect(planIds).not.toContain(PLAN_IDS.oldCompleted);
    // Cancelled work never appears, even when recent.
    expect(planIds).not.toContain(PLAN_IDS.recentCancelled);
    // Recent completions stay: 2 days ago, and the cutoff day itself.
    expect(planIds).toContain(PLAN_IDS.recentCompleted);
    expect(planIds).toContain(PLAN_IDS.edgeCompleted);
    // Active work stays whatever its date: 30 and 45 days out, past or future.
    expect(planIds).toContain(PLAN_IDS.oldScheduled);
    expect(planIds).toContain(PLAN_IDS.oldInProgress);
    expect(planIds).toContain(PLAN_IDS.futureScheduled);
    expect(planIds).toHaveLength(WINDOWED_PLAN_IDS.length);
  });

  it("carries the window on the plan queries themselves", async () => {
    await loadDispatchSnapshot({ boardWindow: { completedSince: cutoff } });

    const planCalls = queryCalls.filter((call) => call.table === "dispatch_plans");
    // Active read: everything except completed/cancelled, filtered in SQL.
    expect(
      planCalls.some(
        (call) =>
          call.method === "not" &&
          call.args[0] === "dispatch_status" &&
          call.args[1] === "in" &&
          call.args[2] === "(completed,cancelled)",
      ),
    ).toBe(true);
    // Completed read: status match plus the recency bound on target_date.
    expect(
      planCalls.some(
        (call) =>
          call.method === "eq" &&
          call.args[0] === "dispatch_status" &&
          call.args[1] === "completed",
      ),
    ).toBe(true);
    expect(
      planCalls.some(
        (call) =>
          call.method === "gte" &&
          call.args[0] === "target_date" &&
          call.args[1] === cutoff,
      ),
    ).toBe(true);
  });

  it("scopes assignments, blocks, and events to the windowed plans", async () => {
    const snapshot = await loadDispatchSnapshot({
      boardWindow: { completedSince: cutoff },
    });

    expect(snapshot.assignments.map((a) => a.id).sort()).toEqual([
      "assign-old-scheduled",
      "assign-recent-completed",
    ]);
    expect(snapshot.scheduleBlocks.map((b) => b.id)).toEqual([
      "block-old-scheduled",
    ]);
    expect(snapshot.events.map((e) => e.id)).toEqual(["event-recent-completed"]);

    for (const table of ["crew_assignments", "schedule_blocks", "dispatch_events"]) {
      const scopedIns = queryCalls.filter(
        (call) => call.table === table && call.method === "in",
      );
      expect(scopedIns.length).toBeGreaterThan(0);
      for (const call of scopedIns) {
        expect(call.args[0]).toBe("dispatch_plan_id");
        const ids = call.args[1] as string[];
        expect(ids.length).toBeLessThanOrEqual(80);
        for (const id of ids) expect(WINDOWED_PLAN_IDS).toContain(id);
      }
    }
  });

  it("the board service read applies the 7-day company-timezone window", async () => {
    const snapshot = await loadBoardDispatchSnapshot();

    expect(snapshot.plans.map((plan) => plan.id)).toEqual(
      expect.arrayContaining(WINDOWED_PLAN_IDS),
    );
    expect(snapshot.plans).toHaveLength(WINDOWED_PLAN_IDS.length);

    const gteCalls = queryCalls.filter(
      (call) => call.table === "dispatch_plans" && call.method === "gte",
    );
    expect(gteCalls).toHaveLength(1);
    expect(gteCalls[0].args).toEqual([
      "target_date",
      addCalendarDays(todayInCompanyTimeZone(), -7),
    ]);
  });

  it("the unwindowed snapshot still loads the full history", async () => {
    const snapshot = await loadDispatchSnapshot();

    expect(snapshot.plans).toHaveLength(7);
    expect(snapshot.plans.map((plan) => plan.id)).toContain(PLAN_IDS.oldCompleted);
    expect(snapshot.plans.map((plan) => plan.id)).toContain(
      PLAN_IDS.recentCancelled,
    );
    expect(snapshot.assignments).toHaveLength(3);
    expect(snapshot.events).toHaveLength(2);
    // No window filters ride on the unwindowed plan queries.
    const planCalls = queryCalls.filter((call) => call.table === "dispatch_plans");
    expect(planCalls.some((call) => call.method === "not")).toBe(false);
    expect(planCalls.some((call) => call.method === "gte")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadDispatchDataForJobs — scoped read for timelines
// ---------------------------------------------------------------------------

describe("loadDispatchDataForJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(tables)) delete tables[key];
    queryCalls.length = 0;
    seedTables();
  });

  it("returns only plans and events for the requested job IDs", async () => {
    const result = await loadDispatchDataForJobs([
      `job-${PLAN_IDS.recentCompleted}`,
    ]);

    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].id).toBe(PLAN_IDS.recentCompleted);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe("event-recent-completed");
  });

  it("returns empty when no job IDs are given", async () => {
    const result = await loadDispatchDataForJobs([]);
    expect(result.plans).toHaveLength(0);
    expect(result.events).toHaveLength(0);
  });

  it("returns plans and events for multiple jobs", async () => {
    const result = await loadDispatchDataForJobs([
      `job-${PLAN_IDS.oldCompleted}`,
      `job-${PLAN_IDS.recentCompleted}`,
    ]);

    expect(result.plans).toHaveLength(2);
    const planIds = result.plans.map((p) => p.id);
    expect(planIds).toContain(PLAN_IDS.oldCompleted);
    expect(planIds).toContain(PLAN_IDS.recentCompleted);
    expect(result.events).toHaveLength(2);
  });

  it("scopes queries to the requested job IDs via .in()", async () => {
    await loadDispatchDataForJobs([`job-${PLAN_IDS.recentCompleted}`]);

    const planInCalls = queryCalls.filter(
      (call) => call.table === "dispatch_plans" && call.method === "in",
    );
    expect(planInCalls.length).toBeGreaterThan(0);
    for (const call of planInCalls) {
      expect(call.args[0]).toBe("job_id");
      expect(call.args[1]).toEqual([`job-${PLAN_IDS.recentCompleted}`]);
    }

    const eventInCalls = queryCalls.filter(
      (call) => call.table === "dispatch_events" && call.method === "in",
    );
    expect(eventInCalls.length).toBeGreaterThan(0);
    for (const call of eventInCalls) {
      expect(call.args[0]).toBe("dispatch_plan_id");
    }
  });

  it("does not read the entire org-wide snapshot", async () => {
    await loadDispatchDataForJobs([`job-${PLAN_IDS.recentCompleted}`]);

    // Should NOT read crew_assignments or schedule_blocks (timeline doesn't need them).
    const assignmentCalls = queryCalls.filter(
      (call) => call.table === "crew_assignments",
    );
    const blockCalls = queryCalls.filter(
      (call) => call.table === "schedule_blocks",
    );
    expect(assignmentCalls).toHaveLength(0);
    expect(blockCalls).toHaveLength(0);
  });
});
