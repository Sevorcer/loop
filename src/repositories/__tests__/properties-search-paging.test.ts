/**
 * Directory search + paging: properties repository
 *
 * Regression coverage for review issue A: the properties list only ever saw
 * the first 50 records because search ran over whatever page was loaded.
 * The repository now searches server-side across name, address, city and
 * primary system, and returns the exact total.
 *
 * The fake Supabase below actually applies eq/or-ilike/order/range to an
 * in-memory table of 120 properties, so a match sitting at position 88 can
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

    in(field: string, values: unknown[]) {
      this.filters.push((row) => values.includes(row[field]));
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

  const customersTable: Row[] = [
    { id: "cust-owner", name: "Directory Owner LLC", org_id: "org-test" },
  ];

  function propertyRow(index: number, overrides: Partial<Row> = {}): Row {
    const label = String(index).padStart(3, "0");
    return {
      id: `prop-${label}`,
      org_id: "org-test",
      customer_id: "cust-owner",
      name: `Property ${label}`,
      address: `${index} Main St`,
      city: "Seattle",
      state: "WA",
      zip: "98101",
      type: "Residential",
      status: "Active",
      primary_system: "Gas Furnace",
      open_jobs: 0,
      last_visit: null,
      latitude: null,
      longitude: null,
      formatted_address: null,
      place_id: null,
      // Newest first: index 0 is the most recently created row.
      created_at: new Date(BASE_TIME - index * 3_600_000).toISOString(),
      ...overrides,
    };
  }

  const propertiesTable: Row[] = Array.from({ length: 120 }, (_, index) =>
    propertyRow(index),
  );

  // The target property sits at position 88 — beyond any first page of 50.
  propertiesTable[87] = propertyRow(87, {
    name: "Harborview Tower",
    address: "4500 Harborview Dr",
    city: "Tacoma",
    primary_system: "Mitsubishi Hyper Heat",
  });

  // 25 "Harbor" properties for the paging test, all beyond the first 50.
  for (let i = 0; i < 25; i += 1) {
    propertiesTable[60 + i] = propertyRow(60 + i, {
      name: `Harbor Point ${String(i + 1).padStart(2, "0")}`,
    });
  }

  const queries: Array<{ table: string; query: FakeQuery }> = [];
  const tables: Record<string, Row[]> = {
    properties: propertiesTable,
    customers: customersTable,
  };
  const fakeSupabase = {
    from(table: string) {
      const query = new FakeQuery(tables[table] ?? []);
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

import { listProperties, listPropertyCities } from "@/repositories/properties";

type RecordedQuery = (typeof queries)[number]["query"];

function lastPropertiesQuery(): RecordedQuery {
  const entry = [...queries].reverse().find((item) => item.table === "properties");
  if (!entry) throw new Error("No properties query recorded");
  return entry.query;
}

describe("listProperties directory search + paging", () => {
  it("reports the exact total, not the loaded page size", async () => {
    const result = await listProperties();

    expect(result.items).toHaveLength(50);
    expect(result.total).toBe(120);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(lastPropertiesQuery().selectOptions).toEqual({ count: "exact" });
  });

  it("does not surface the position-88 property on the default first page", async () => {
    const result = await listProperties();
    expect(result.items.some((property) => property.id === "prop-087")).toBe(false);
  });

  it("finds a property beyond the first 50 by name via server-side search", async () => {
    const result = await listProperties(undefined, { search: "harborview", pageSize: 10 });

    expect(result.total).toBe(1);
    expect(result.items.map((property) => property.id)).toEqual(["prop-087"]);
    expect(result.items[0].customer).toBe("Directory Owner LLC");
    expect(lastPropertiesQuery().orFilter).toContain("name.ilike.%harborview%");
  });

  it("matches on address, city and primary system — not just name", async () => {
    const byAddress = await listProperties(undefined, { search: "4500" });
    expect(byAddress.items.map((property) => property.id)).toEqual(["prop-087"]);

    const bySystem = await listProperties(undefined, { search: "hyper heat" });
    expect(bySystem.items.map((property) => property.id)).toEqual(["prop-087"]);

    const orFilter = lastPropertiesQuery().orFilter ?? "";
    expect(orFilter).toContain("address.ilike.");
    expect(orFilter).toContain("city.ilike.");
    expect(orFilter).toContain("primary_system.ilike.");
  });

  it("keeps the search term applied when requesting page 2", async () => {
    // 25 "Harbor Point" rows plus Harborview Tower also matches "harbor".
    const page1 = await listProperties(undefined, { search: "harbor", page: 1, pageSize: 10 });
    expect(page1.total).toBe(26);
    expect(page1.items).toHaveLength(10);

    const page2 = await listProperties(undefined, { search: "harbor", page: 2, pageSize: 10 });
    expect(page2.total).toBe(26);
    expect(page2.items).toHaveLength(10);
    expect(page2.page).toBe(2);

    const page1Ids = new Set(page1.items.map((property) => property.id));
    expect(page2.items.every((property) => !page1Ids.has(property.id))).toBe(true);
    expect(page2.items.every((property) => property.name.startsWith("Harbor Point"))).toBe(true);

    const query = lastPropertiesQuery();
    expect(query.orFilter).toContain("harbor");
    expect(query.rangeFrom).toBe(10);
    expect(query.rangeTo).toBe(19);
  });

  it("applies status, type and city filters server-side", async () => {
    const result = await listProperties(undefined, {
      search: "harborview",
      status: "Active",
      type: "Residential",
      city: "Tacoma",
    });
    expect(result.items.map((property) => property.id)).toEqual(["prop-087"]);

    const noMatch = await listProperties(undefined, {
      search: "harborview",
      status: "Inactive",
    });
    expect(noMatch.total).toBe(0);
    expect(noMatch.items).toHaveLength(0);
  });
});

describe("listPropertyCities", () => {
  it("returns every distinct city across the whole directory, sorted", async () => {
    await expect(listPropertyCities()).resolves.toEqual(["Seattle", "Tacoma"]);
  });
});
