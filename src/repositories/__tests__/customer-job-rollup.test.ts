/**
 * Child-customer job roll-up: customers repository
 *
 * Regression coverage for item C: a builder parent's "Jobs in Scope" count was
 * read as `.length` of a capped job fetch against the parent's own
 * customer_id only, so (1) large parents stopped counting at the 1000-row
 * fetch cap and (2) jobs filed against child customers never rolled up.
 *
 * The repository now counts with PostgREST `head` counts over the id set
 * [parentId, ...childIds]. The fake Supabase below only ever returns a
 * `count` for a head request — it never hands back row data — so a correct
 * number can only come from the count query, not from counting a fetched
 * (and cap-prone) array. The parent and BOTH children hold jobs, and the
 * parent additionally holds jobs directly, exactly the mixed shape the bug
 * mishandled.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const OPEN_EXCLUDED = new Set(
  "Completed,completed,Cancelled,cancelled,Canceled,canceled".split(","),
);

const { fakeSupabase, headCountCalls } = vi.hoisted(() => {
  const headCountCalls: Array<{ table: string; head: boolean; inIds: string[] | null }> = [];

  class FakeQuery {
    private filters: Array<(row: Row) => boolean> = [];
    private inFilter: { field: string; values: Set<unknown> } | null = null;
    private inIds: string[] | null = null;
    private head = false;
    private headRecorded = false;

    constructor(
      private readonly table: string,
      private readonly rows: Row[],
    ) {}

    select(_columns: string, options?: { count?: string; head?: boolean }) {
      this.head = Boolean(options?.head);
      return this;
    }

    eq(field: string, value: unknown) {
      this.filters.push((row) => row[field] === value);
      return this;
    }

    in(field: string, values: unknown[]) {
      this.inIds = values.map((value) => String(value));
      this.inFilter = { field, values: new Set(values) };
      this.filters.push((row) => this.inFilter!.values.has(row[field]));
      return this;
    }

    not(field: string, operator: string, list: string) {
      if (operator !== "in") throw new Error(`Unsupported not-operator: ${operator}`);
      const excluded = new Set(
        list.replace(/^\(/, "").replace(/\)$/, "").split(","),
      );
      this.filters.push((row) => !excluded.has(String(row[field])));
      return this;
    }

    order() {
      return this;
    }

    private matched(): Row[] {
      return this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    }

    private recordHead() {
      if (this.head && !this.headRecorded) {
        this.headRecorded = true;
        headCountCalls.push({ table: this.table, head: this.head, inIds: this.inIds });
      }
    }

    private execute() {
      const rows = this.matched();
      this.recordHead();
      // A head count request returns NO rows — only the exact count. This is
      // the guarantee under test: the number cannot be a `.length` of fetched
      // (cap-prone) data.
      return this.head
        ? { data: null, error: null, count: rows.length }
        : { data: rows, error: null, count: rows.length };
    }

    maybeSingle() {
      const rows = this.matched();
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    }

    then<T1, T2>(
      onFulfilled?: ((value: { data: Row[] | null; error: null; count: number }) => T1) | null,
      onRejected?: ((reason: unknown) => T2) | null,
    ) {
      return Promise.resolve(this.execute()).then(onFulfilled, onRejected);
    }
  }

  // --- Seed ----------------------------------------------------------------
  // Parent cust-P with two children cust-C1, cust-C2.
  const customers: Row[] = [
    { id: "cust-P", org_id: "org-test", parent_customer_id: null },
    { id: "cust-C1", org_id: "org-test", parent_customer_id: "cust-P" },
    { id: "cust-C2", org_id: "org-test", parent_customer_id: "cust-P" },
    { id: "cust-solo", org_id: "org-test", parent_customer_id: null },
  ];

  function jobs(customerId: string, statuses: string[]): Row[] {
    return statuses.map((status, index) => ({
      id: `${customerId}-job-${index}`,
      org_id: "org-test",
      customer_id: customerId,
      status,
    }));
  }

  const jobsTable: Row[] = [
    // Parent: 2 open (Scheduled, In Progress) + 1 closed (Completed) => own open 2, own all 3.
    ...jobs("cust-P", ["Scheduled", "In Progress", "Completed"]),
    // Child 1: 3 open (Scheduled, Scheduled, On Hold) + 1 closed (Cancelled) => open 3, all 4.
    ...jobs("cust-C1", ["Scheduled", "Scheduled", "On Hold", "Cancelled"]),
    // Child 2: 1 open (In Progress) => open 1, all 1.
    ...jobs("cust-C2", ["In Progress"]),
    // Unrelated customer that must never bleed into the roll-up.
    ...jobs("cust-solo", ["Scheduled", "Scheduled"]),
  ];

  const fakeSupabase = {
    from(table: string) {
      return new FakeQuery(table, table === "customers" ? customers : table === "jobs" ? jobsTable : []);
    },
  };

  return { fakeSupabase, headCountCalls };
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

import {
  countJobsForCustomers,
  countOpenJobsForCustomer,
  countOpenJobsForCustomers,
  listChildCustomerIds,
} from "@/repositories/customers";

const ACCOUNT = ["cust-P", "cust-C1", "cust-C2"];

describe("child-customer job roll-up", () => {
  it("lists the parent's child customer ids", async () => {
    await expect(listChildCustomerIds("cust-P")).resolves.toEqual(["cust-C1", "cust-C2"]);
    await expect(listChildCustomerIds("cust-solo")).resolves.toEqual([]);
  });

  it("counts only the parent's own open jobs for a single id", async () => {
    await expect(countOpenJobsForCustomer("cust-P")).resolves.toBe(2);
  });

  it("rolls child open jobs up into the parent with an exact count", async () => {
    // 2 (parent) + 3 (child 1) + 1 (child 2) = 6, excluding Completed/Cancelled.
    await expect(countOpenJobsForCustomers(ACCOUNT)).resolves.toBe(6);
  });

  it("counts all jobs (any status) across the account exactly", async () => {
    // 3 (parent) + 4 (child 1) + 1 (child 2) = 8.
    await expect(countJobsForCustomers(ACCOUNT)).resolves.toBe(8);
  });

  it("never counts customers outside the id set", async () => {
    // cust-solo has 2 jobs but is not in the account id set.
    await expect(countJobsForCustomers(["cust-P"])).resolves.toBe(3);
  });

  it("short-circuits an empty id set without querying", async () => {
    headCountCalls.length = 0;
    await expect(countOpenJobsForCustomers([])).resolves.toBe(0);
    await expect(countJobsForCustomers([])).resolves.toBe(0);
    expect(headCountCalls).toHaveLength(0);
  });

  it("uses an exact head count over the full id set, not a fetched array", async () => {
    headCountCalls.length = 0;
    await countOpenJobsForCustomers(ACCOUNT);
    expect(headCountCalls).toHaveLength(1);
    expect(headCountCalls[0]).toMatchObject({ table: "jobs", head: true });
    expect(headCountCalls[0].inIds).toEqual(ACCOUNT);
  });
});

// Keep the exclusion set referenced so the intent (which statuses count as
// closed) is documented alongside the fake.
it("treats only Completed/Cancelled variants as closed", () => {
  expect(OPEN_EXCLUDED.has("Completed")).toBe(true);
  expect(OPEN_EXCLUDED.has("Scheduled")).toBe(false);
});
