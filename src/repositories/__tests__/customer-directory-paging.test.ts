/**
 * Properties name resolution used an unpaged customers(id,name) read.
 * PostgREST caps a response at 1,000 rows; live has 1,395 customers, so
 * roughly the last 395 names could never resolve. loadCustomerDirectory now
 * pages by id until a short page.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const { fakeSupabase, customerRanges } = vi.hoisted(() => {
  const customerRanges: Array<{ from: number; to: number }> = [];

  const customersTable: Row[] = Array.from({ length: 1395 }, (_, i) => ({
    id: `cust-${String(i).padStart(4, "0")}`,
    name: `Customer ${i}`,
    org_id: "org-1",
  }));

  const propertiesTable: Row[] = [
    {
      id: "prop-late",
      org_id: "org-1",
      customer_id: "cust-1200",
      name: "Late site",
      address: "1 Main",
      city: "Mukilteo",
      state: "WA",
      zip: "98275",
      type: "Commercial",
      status: "Active",
      primary_system: "Heat Pump",
      open_jobs: 0,
      last_visit: null,
      latitude: null,
      longitude: null,
      formatted_address: null,
      place_id: null,
      created_at: "2026-11-01T00:00:00.000Z",
    },
  ];

  class FakeQuery {
    selectOptions: unknown = undefined;
    private filters: Array<(row: Row) => boolean> = [];
    private orderField: string | null = null;
    private orderAscending = true;
    private rangeFrom: number | null = null;
    private rangeTo: number | null = null;
    private usedIn = false;

    constructor(
      private readonly table: string,
      private readonly rows: Row[],
    ) {}

    select(_columns: string, options?: unknown) {
      this.selectOptions = options;
      return this;
    }
    eq(field: string, value: unknown) {
      this.filters.push((row) => row[field] === value);
      return this;
    }
    in(field: string, _values: unknown[]) {
      this.usedIn = true;
      // Force getCustomerNameMap to miss so withCustomerNames loads the full
      // directory — the path that used to stop at 1,000 rows.
      this.filters.push(() => false);
      void field;
      return this;
    }
    is(field: string, value: null) {
      this.filters.push((row) => row[field] === value);
      return this;
    }
    or() {
      return this;
    }
    order(field: string, options?: { ascending?: boolean }) {
      this.orderField = field;
      this.orderAscending = options?.ascending ?? true;
      return this;
    }
    range(from: number, to: number) {
      this.rangeFrom = from;
      this.rangeTo = to;
      return this;
    }

    private execute() {
      if (this.table === "customers" && this.rangeFrom !== null) {
        customerRanges.push({ from: this.rangeFrom, to: this.rangeTo ?? this.rangeFrom });
      }
      let rows = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
      if (this.orderField) {
        const field = this.orderField;
        const direction = this.orderAscending ? 1 : -1;
        rows = [...rows].sort((a, b) =>
          String(a[field]) < String(b[field]) ? -direction : direction,
        );
      }
      const count = rows.length;
      if (this.rangeFrom !== null) {
        rows = rows.slice(this.rangeFrom, (this.rangeTo ?? rows.length - 1) + 1);
      } else if (this.table === "customers" && !this.usedIn) {
        // Unpaged customers read (legacy behaviour) would stop at 1,000.
        rows = rows.slice(0, 1000);
      }
      return { data: rows, error: null, count };
    }

    then<T1, T2>(
      onFulfilled?: ((value: { data: Row[]; error: null; count: number }) => T1) | null,
      onRejected?: ((reason: unknown) => T2) | null,
    ) {
      return Promise.resolve(this.execute()).then(onFulfilled, onRejected);
    }
  }

  const tables: Record<string, Row[]> = {
    customers: customersTable,
    properties: propertiesTable,
    jobs: [],
  };

  const fakeSupabase = {
    from(table: string) {
      return new FakeQuery(table, tables[table] ?? []);
    },
  };

  return { fakeSupabase, customerRanges };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: vi.fn().mockResolvedValue({
    supabase: fakeSupabase,
    orgId: "org-1",
  }),
}));

import { listProperties } from "@/repositories/properties";

describe("loadCustomerDirectory paging", () => {
  it("pages past the 1,000-row PostgREST cap so a late customer still resolves", async () => {
    customerRanges.length = 0;

    const result = await listProperties(undefined, { page: 1, pageSize: 50 });

    expect(customerRanges.some((r) => r.from === 0 && r.to === 999)).toBe(true);
    expect(customerRanges.some((r) => r.from === 1000 && r.to === 1999)).toBe(true);

    const item = result.items.find((property) => property.id === "prop-late");
    expect(item?.customer).toBe("Customer 1200");
    expect(item?.customerId).toBe("cust-1200");
  });
});
