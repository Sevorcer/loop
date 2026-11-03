/**
 * Directory search + paging: customers repository
 *
 * Regression coverage for review issue A: the customers list only ever saw
 * the first 50 records because search ran (name-only) over whatever page was
 * loaded. The repository now searches server-side across name, primary
 * contact, street and city, and returns the exact total.
 *
 * The fake Supabase below actually applies eq/or-ilike/order/range to an
 * in-memory table of 120 customers, so a match sitting at position 88 can
 * only come back if the query itself reaches it.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const { fakeSupabase, queries } = vi.hoisted(() => {
  function ilikeMatch(value: unknown, pattern: string): boolean {
    const term = pattern.replace(/^%/, "").replace(/%$/, "").replace(/\\(.)/g, "$1");
    return String(value ?? "").toLowerCase().includes(term.toLowerCase());
  }

  class FakeQuery {
    selectOptions: unknown = undefined;
    orFilter: string | null = null;
    rangeFrom: number | null = null;
    rangeTo: number | null = null;
    private filters: Array<(row: Row) => boolean> = [];
    private orderField: string | null = null;
    private orderAscending = true;

    constructor(private readonly rows: Row[]) {}

    select(_columns: string, options?: unknown) {
      this.selectOptions = options;
      return this;
    }

    eq(field: string, value: unknown) {
      this.filters.push((row) => row[field] === value);
      return this;
    }

    or(filter: string) {
      this.orFilter = filter;
      const clauses = filter.split(",").map((part) => {
        const match = /^([^.]+)\.ilike\.(.*)$/.exec(part.trim());
        if (!match) throw new Error(`Unsupported or-clause in test fake: ${part}`);
        return { field: match[1], pattern: match[2] };
      });
      this.filters.push((row) =>
        clauses.some((clause) => ilikeMatch(row[clause.field], clause.pattern)),
      );
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
      }
      return { data: rows, error: null, count };
    }

    then<TResult1, TResult2>(
      onFulfilled?: ((value: { data: Row[]; error: null; count: number }) => TResult1) | null,
      onRejected?: ((reason: unknown) => TResult2) | null,
    ) {
      return Promise.resolve(this.execute()).then(onFulfilled, onRejected);
    }
  }

  const BASE_TIME = Date.parse("2026-11-02T00:00:00.000Z");

  function customerRow(index: number, overrides: Partial<Row> = {}): Row {
    const label = String(index).padStart(3, "0");
    return {
      id: `cust-${label}`,
      name: `Customer ${label}`,
      primary_contact: `Contact ${label}`,
      email: `customer${label}@example.com`,
      phone: "555-0100",
      phone2: "",
      city: "Seattle",
      street: `${index} Main St`,
      zip: "98101",
      notes: "",
      status: "Active",
      property_count: 0,
      open_jobs: 0,
      last_activity: null,
      // Newest first: index 0 is the most recently created row.
      created_at: new Date(BASE_TIME - index * 3_600_000).toISOString(),
      org_id: "org-test",
      ...overrides,
    };
  }

  const customersTable: Row[] = Array.from({ length: 120 }, (_, index) =>
    customerRow(index),
  );

  // The target customer sits at position 88 — beyond any first page of 50.
  customersTable[87] = customerRow(87, {
    name: "Zebra Kenmore LLC",
    primary_contact: "Ken Watanabe",
    street: "8800 Kenmore Ave",
    city: "Kenmore",
  });

  // 25 "Harbor" customers for the paging test, all beyond the first 50.
  for (let i = 0; i < 25; i += 1) {
    customersTable[60 + i] = customerRow(60 + i, {
      name: `Harbor View ${String(i + 1).padStart(2, "0")}`,
    });
  }

  const queries: Array<{ table: string; query: FakeQuery }> = [];
  const fakeSupabase = {
    from(table: string) {
      const query = new FakeQuery(table === "customers" ? customersTable : []);
      queries.push({ table, query });
      return query;
    },
  };

  return { fakeSupabase, queries };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: vi.fn().mockResolvedValue({
    supabase: fakeSupabase,
    orgId: "org-test",
  }),
}));

vi.mock("@/repositories/properties", () => ({
  loadLinkedPropertyIds: vi.fn().mockResolvedValue(new Map()),
}));

import { listCustomerCities, listCustomers } from "@/repositories/customers";

type RecordedQuery = (typeof queries)[number]["query"];

function lastCustomersQuery(): RecordedQuery {
  const entry = [...queries].reverse().find((item) => item.table === "customers");
  if (!entry) throw new Error("No customers query recorded");
  return entry.query;
}

describe("listCustomers directory search + paging", () => {
  it("reports the exact total, not the loaded page size", async () => {
    const result = await listCustomers();

    expect(result.items).toHaveLength(50);
    expect(result.total).toBe(120);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(lastCustomersQuery().selectOptions).toEqual({ count: "exact" });
  });

  it("does not surface the position-88 customer on the default first page", async () => {
    const result = await listCustomers();
    expect(result.items.some((customer) => customer.id === "cust-087")).toBe(false);
  });

  it("finds a customer beyond the first 50 by name via server-side search", async () => {
    const result = await listCustomers({ search: "kenmore", pageSize: 10 });

    expect(result.total).toBe(1);
    expect(result.items.map((customer) => customer.id)).toEqual(["cust-087"]);
    expect(lastCustomersQuery().orFilter).toContain("name.ilike.%kenmore%");
  });

  it("matches on primary contact, street and city — not just name", async () => {
    const byContact = await listCustomers({ search: "watanabe" });
    expect(byContact.items.map((customer) => customer.id)).toEqual(["cust-087"]);

    const byStreet = await listCustomers({ search: "8800" });
    expect(byStreet.items.map((customer) => customer.id)).toEqual(["cust-087"]);

    const orFilter = lastCustomersQuery().orFilter ?? "";
    expect(orFilter).toContain("primary_contact.ilike.");
    expect(orFilter).toContain("street.ilike.");
    expect(orFilter).toContain("city.ilike.");
  });

  it("keeps the search term applied when requesting page 2", async () => {
    const page1 = await listCustomers({ search: "harbor", page: 1, pageSize: 10 });
    expect(page1.total).toBe(25);
    expect(page1.items).toHaveLength(10);

    const page2 = await listCustomers({ search: "harbor", page: 2, pageSize: 10 });
    expect(page2.total).toBe(25);
    expect(page2.items).toHaveLength(10);
    expect(page2.page).toBe(2);

    const page1Ids = new Set(page1.items.map((customer) => customer.id));
    expect(page2.items.every((customer) => !page1Ids.has(customer.id))).toBe(true);
    expect(page2.items.every((customer) => customer.name.startsWith("Harbor View"))).toBe(true);

    const query = lastCustomersQuery();
    expect(query.orFilter).toContain("harbor");
    expect(query.rangeFrom).toBe(10);
    expect(query.rangeTo).toBe(19);
  });

  it("escapes ilike wildcards and strips or-grammar characters from the term", async () => {
    await listCustomers({ search: "50% off, (sale)*" });

    const orFilter = lastCustomersQuery().orFilter ?? "";
    // Grammar characters are gone, so the or-filter keeps exactly its
    // four column clauses (a comma or paren from the term would add more).
    expect(orFilter.split(",")).toHaveLength(4);
    expect(orFilter).not.toContain("(");
    // Wildcards are escaped, so they match literally instead of widening.
    expect(orFilter).toContain("50\\%");
    expect(orFilter).toContain("\\*");
    expect(orFilter).not.toContain("%*");
  });

  it("applies status and city filters server-side", async () => {
    const result = await listCustomers({ search: "kenmore", status: "Active", city: "Kenmore" });
    expect(result.items.map((customer) => customer.id)).toEqual(["cust-087"]);

    const noMatch = await listCustomers({ search: "kenmore", status: "Inactive" });
    expect(noMatch.total).toBe(0);
    expect(noMatch.items).toHaveLength(0);
  });
});

describe("listCustomerCities", () => {
  it("returns every distinct city across the whole directory, sorted", async () => {
    await expect(listCustomerCities()).resolves.toEqual(["Kenmore", "Seattle"]);
  });
});
