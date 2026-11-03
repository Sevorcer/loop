/**
 * Installed-systems tile counts + un-capped snapshot (Task 6).
 *
 * Regression coverage for the two root causes behind "Systems 0 · Active
 * Warranties 0 · Expiring Soon 0 · Expired 0" on an org with thousands of
 * systems:
 *
 *   1. Tiles were computed from `.length` of a snapshot that PostgREST
 *      silently capped at 1,000 rows (or that collapsed to [] on error).
 *      They are now exact, server-side `count: "exact", head: true` queries.
 *   2. The snapshot itself stopped at 1,000 rows. It now pages through the
 *      whole table so nothing is silently dropped.
 *
 * The fake Supabase below actually applies eq/neq/gte/lte/lt/range to an
 * in-memory table, so a count or a row can only come back if the query that
 * produced it is correct.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const { fakeSupabase, queries, setTable } = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {
    installed_systems: [],
    technical_profiles: [],
  };

  class FakeQuery {
    selectOptions: unknown = undefined;
    head = false;
    rangeFrom: number | null = null;
    rangeTo: number | null = null;
    private filters: Array<(row: Row) => boolean> = [];

    constructor(private readonly rows: Row[]) {}

    select(_columns: string, options?: { count?: string; head?: boolean }) {
      this.selectOptions = options;
      this.head = options?.head ?? false;
      return this;
    }

    eq(field: string, value: unknown) {
      this.filters.push((row) => row[field] === value);
      return this;
    }

    neq(field: string, value: unknown) {
      this.filters.push((row) => row[field] !== value);
      return this;
    }

    gte(field: string, value: unknown) {
      this.filters.push((row) => String(row[field]) >= String(value));
      return this;
    }

    lte(field: string, value: unknown) {
      this.filters.push((row) => String(row[field]) <= String(value));
      return this;
    }

    lt(field: string, value: unknown) {
      this.filters.push((row) => String(row[field]) < String(value));
      return this;
    }

    order() {
      return this;
    }

    range(from: number, to: number) {
      this.rangeFrom = from;
      this.rangeTo = to;
      return this;
    }

    private execute() {
      const rows = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
      const count = rows.length;

      if (this.head) {
        return { data: null, error: null, count };
      }

      const sliced =
        this.rangeFrom !== null
          ? rows.slice(this.rangeFrom, (this.rangeTo ?? rows.length - 1) + 1)
          : rows;
      return { data: sliced, error: null, count };
    }

    then<TResult1, TResult2>(
      onFulfilled?: ((value: { data: Row[] | null; error: null; count: number }) => TResult1) | null,
      onRejected?: ((reason: unknown) => TResult2) | null,
    ) {
      return Promise.resolve(this.execute()).then(onFulfilled, onRejected);
    }
  }

  const queries: Array<{ table: string; query: FakeQuery }> = [];
  const fakeSupabase = {
    from(table: string) {
      const query = new FakeQuery(tables[table] ?? []);
      queries.push({ table, query });
      return query;
    },
  };

  function setTable(table: string, rows: Row[]) {
    tables[table] = rows;
  }

  return { fakeSupabase, queries, setTable };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: vi.fn().mockResolvedValue({
    supabase: fakeSupabase,
    orgId: "org-test",
  }),
}));

import {
  loadInstalledSystemsCounts,
  loadInstalledSystemsSnapshot,
} from "@/repositories/installedSystems";

function iso(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function systemRow(index: number, overrides: Partial<Row> = {}): Row {
  const label = String(index).padStart(4, "0");
  return {
    id: `sys-${label}`,
    org_id: "org-test",
    technical_identity_id: `ti-${label}`,
    technical_profile_id: null,
    system_name: `System ${label}`,
    lifecycle_status: "Needs Review",
    customer_name: `Customer ${label}`,
    property_id: null,
    property_name: `Property ${label}`,
    location: "",
    estimate_id: null,
    job_id: null,
    job_number: null,
    match_state: "unmatched",
    match_confidence: 0,
    install_date: "2026-01-01",
    manufacturer: "Trane",
    model_number: "XR16",
    serial_numbers: [],
    warranty_expiry: "",
    warranty_registered: false,
    warranty_registered_at: null,
    warranty_registered_by: null,
    accessories: [],
    linked_workflow_ids: [],
    permit_ready: false,
    operational_history: [],
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("loadInstalledSystemsCounts", () => {
  it("returns exact counts per warranty bucket, excluding empty/other-org rows", async () => {
    queries.length = 0;
    setTable("installed_systems", [
      systemRow(0, { warranty_expiry: iso(-100) }), // expired
      systemRow(1, { warranty_expiry: iso(-1) }), // expired (yesterday)
      systemRow(2, { warranty_expiry: iso(10) }), // active + expiring soon
      systemRow(3, { warranty_expiry: iso(100) }), // active, not soon
      systemRow(4, { warranty_expiry: "" }), // no warranty — excluded everywhere
      // Different org: must never be counted.
      systemRow(5, { org_id: "org-other", warranty_expiry: iso(5) }),
    ]);

    const counts = await loadInstalledSystemsCounts();

    expect(counts.total).toBe(5);
    expect(counts.activeWarranties).toBe(2);
    expect(counts.expiringSoon).toBe(1);
    expect(counts.expired).toBe(2);
  });

  it("uses exact, head-only count queries (never a row fetch)", async () => {
    queries.length = 0;
    setTable("installed_systems", [systemRow(0, { warranty_expiry: iso(10) })]);

    await loadInstalledSystemsCounts();

    const countQueries = queries.filter((entry) => entry.table === "installed_systems");
    expect(countQueries).toHaveLength(4);
    for (const entry of countQueries) {
      expect(entry.query.selectOptions).toEqual({ count: "exact", head: true });
    }
  });
});

describe("loadInstalledSystemsSnapshot", () => {
  it("pages past the 1,000-row cap instead of silently truncating", async () => {
    queries.length = 0;
    const rows = Array.from({ length: 1200 }, (_, index) =>
      systemRow(index, { warranty_expiry: index < 400 ? iso(-10) : iso(50) }),
    );
    setTable("installed_systems", rows);
    setTable("technical_profiles", []);

    const snapshot = await loadInstalledSystemsSnapshot();

    // All 1,200 systems come back — not just the first 1,000-row page.
    expect(snapshot.installedSystems).toHaveLength(1200);
    // Counts are exact and independent of the paged row fetch.
    expect(snapshot.counts.total).toBe(1200);
    expect(snapshot.counts.expired).toBe(400);
    expect(snapshot.counts.activeWarranties).toBe(800);

    // Proof it actually ranged more than one page of installed_systems.
    const rangeCalls = queries.filter(
      (entry) => entry.table === "installed_systems" && entry.query.rangeFrom !== null,
    );
    expect(rangeCalls.length).toBeGreaterThanOrEqual(2);
  });
});
