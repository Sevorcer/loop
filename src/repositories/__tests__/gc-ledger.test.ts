/**
 * GC Ledger repository — unit tests
 *
 * Covers:
 *   1. Roll-up math with multiple change orders
 *   2. Ledger reads price from job_bids, invoice from jobs (not duplicated)
 *   3. Builder overview lists only parent customers with child jobs
 *   4. Open-job count matches production's Title Case statuses
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Fake data
// ---------------------------------------------------------------------------

const ORG_ID = "org-test";
const BUILDER_ID = "cust-builder";
const CHILD_1 = "cust-child-1";
const CHILD_2 = "cust-child-2";
const JOB_1 = "job-1";
const JOB_2 = "job-2";
const ENTRY_1 = "entry-1";
const ENTRY_2 = "entry-2";

const customers = [
  { id: BUILDER_ID, org_id: ORG_ID, parent_customer_id: null, name: "Builder Corp", phone: "", email: "", street: "", city: "", zip: "", state: "" },
  { id: CHILD_1, org_id: ORG_ID, parent_customer_id: BUILDER_ID, name: "Alice Homeowner", phone: "555-0001", email: "alice@test.com", street: "123 Main", city: "Seattle", zip: "98101", state: "WA" },
  { id: CHILD_2, org_id: ORG_ID, parent_customer_id: BUILDER_ID, name: "Bob Homeowner", phone: "555-0002", email: "bob@test.com", street: "456 Oak", city: "Seattle", zip: "98102", state: "WA" },
];

const jobs = [
  { id: JOB_1, org_id: ORG_ID, customer_id: CHILD_1, job_number: "J-100", qb_invoice_number: "INV-001", type: "Install", status: "In Progress" },
  { id: JOB_2, org_id: ORG_ID, customer_id: CHILD_2, job_number: "J-101", qb_invoice_number: "INV-002", type: "Callback", status: "Scheduled" },
];

const ledgerEntries = [
  { id: ENTRY_1, org_id: ORG_ID, job_id: JOB_1, estimate_number: "EST-01", gc_po_number: "PO-01", date_sent: "2026-10-01", date_received: null, balance_cents: 150000, retainer_cents: 50000, notes: "", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
  { id: ENTRY_2, org_id: ORG_ID, job_id: JOB_2, estimate_number: "EST-02", gc_po_number: "", date_sent: "2026-10-15", date_received: "2026-11-01", balance_cents: 0, retainer_cents: 25000, notes: "", created_at: "2026-10-15T00:00:00Z", updated_at: "2026-10-15T00:00:00Z" },
];

const jobBids = [
  { job_id: JOB_1, org_id: ORG_ID, amount_cents: 500000, is_current: true },
  { job_id: JOB_2, org_id: ORG_ID, amount_cents: 200000, is_current: true },
];

const changeOrders = [
  { id: "co-1", org_id: ORG_ID, ledger_entry_id: ENTRY_1, change_order_number: "CO-1", amount_cents: 15000, description: "Extra ductwork", created_at: "2026-10-05T00:00:00Z" },
  { id: "co-2", org_id: ORG_ID, ledger_entry_id: ENTRY_1, change_order_number: "CO-2", amount_cents: 8000, description: "Upgraded filter", created_at: "2026-10-06T00:00:00Z" },
  { id: "co-3", org_id: ORG_ID, ledger_entry_id: ENTRY_2, change_order_number: "CO-1", amount_cents: 3500, description: "Return visit scope", created_at: "2026-10-20T00:00:00Z" },
];

// ---------------------------------------------------------------------------
// Fake Supabase
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function buildFakeQuery(table: string, rows: Row[]) {
  return class FakeQuery {
    private filters: Array<(row: Row) => boolean> = [];
    private headMode = false;
    private countMode: string | undefined;
    private selectedColumns: string | undefined;
    private tbl: string;
    private allRows: Row[];

    constructor() {
      this.tbl = table;
      this.allRows = rows;
    }

    select(columns?: string, options?: { count?: string; head?: boolean }) {
      this.selectedColumns = columns;
      this.headMode = Boolean(options?.head);
      this.countMode = options?.count;
      return this;
    }

    eq(field: string, value: unknown) {
      this.filters.push((row) => row[field] === value);
      return this;
    }

    in(field: string, values: unknown[]) {
      const set = new Set(values);
      this.filters.push((row) => set.has(row[field]));
      return this;
    }

    not(field: string, op: string, list: string) {
      if (op === "in") {
        const excluded = new Set(list.replace(/^\(/, "").replace(/\)$/, "").split(","));
        this.filters.push((row) => !excluded.has(String(row[field])));
      } else if (op === "is") {
        this.filters.push((row) => row[field] !== null && row[field] !== undefined);
      }
      return this;
    }

    order() { return this; }

    private rangeFrom: number | undefined;
    private rangeTo: number | undefined;

    range(from: number, to: number) {
      this.rangeFrom = from;
      this.rangeTo = to;
      return this;
    }

    maybeSingle() {
      const matched = this.allRows.filter((row) => this.filters.every((f) => f(row)));
      return Promise.resolve({ data: matched[0] ?? null, error: null });
    }

    single() {
      const matched = this.allRows.filter((row) => this.filters.every((f) => f(row)));
      return Promise.resolve({ data: matched[0] ?? null, error: null });
    }

    then(resolve: (value: { data: Row[] | null; error: null; count: number | null }) => void) {
      const matched = this.allRows.filter((row) => this.filters.every((f) => f(row)));
      if (this.headMode) {
        resolve({ data: null, error: null, count: matched.length });
      } else if (this.rangeFrom !== undefined && this.rangeTo !== undefined) {
        resolve({
          data: matched.slice(this.rangeFrom, this.rangeTo + 1),
          error: null,
          count: matched.length,
        });
      } else {
        resolve({ data: matched, error: null, count: matched.length });
      }
    }
  };
}

const allData: Record<string, Row[]> = {
  customers,
  jobs,
  gc_ledger_entries: ledgerEntries,
  job_bids: jobBids,
  gc_change_orders: changeOrders,
};

const fakeSupabase = {
  from: (table: string) => {
    const rows = allData[table] ?? [];
    const QueryClass = buildFakeQuery(table, rows);
    return new QueryClass();
  },
};

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: vi.fn().mockResolvedValue({
    orgId: ORG_ID,
    supabase: fakeSupabase,
    mode: "development",
    userId: null,
  }),
}));

// Import after mocking
const {
  listLedgerEntriesForBuilder,
  getBuilderRollup,
  listBuildersWithRollups,
  GC_OPEN_JOB_STATUSES,
} = await import("@/repositories/gcLedger");
const { getStatusVariants } = await import("@/lib/jobs/status");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GC Ledger Repository", () => {
  describe("listLedgerEntriesForBuilder", () => {
    it("reads price from job_bids and invoice number from jobs (not duplicated in ledger)", async () => {
      const entries = await listLedgerEntriesForBuilder(BUILDER_ID);

      expect(entries).toHaveLength(2);

      const entry1 = entries.find((e) => e.jobId === JOB_1);
      expect(entry1).toBeDefined();
      // Price comes from job_bids, NOT from ledger entry
      expect(entry1!.priceCents).toBe(500000);
      // Invoice comes from jobs.qb_invoice_number, NOT from ledger entry
      expect(entry1!.invoiceNumber).toBe("INV-001");
      // Other fields come from the ledger entry itself
      expect(entry1!.estimateNumber).toBe("EST-01");
      expect(entry1!.gcPoNumber).toBe("PO-01");

      const entry2 = entries.find((e) => e.jobId === JOB_2);
      expect(entry2!.priceCents).toBe(200000);
      expect(entry2!.invoiceNumber).toBe("INV-002");
    });

    it("includes homeowner name and site address from child customers", async () => {
      const entries = await listLedgerEntriesForBuilder(BUILDER_ID);

      const entry1 = entries.find((e) => e.jobId === JOB_1);
      expect(entry1!.homeownerName).toBe("Alice Homeowner");
      expect(entry1!.siteAddress).toContain("123 Main");
      expect(entry1!.homeownerPhone).toBe("555-0001");
      expect(entry1!.homeownerEmail).toBe("alice@test.com");
    });

    it("attaches change orders to the correct entry", async () => {
      const entries = await listLedgerEntriesForBuilder(BUILDER_ID);

      const entry1 = entries.find((e) => e.id === ENTRY_1);
      expect(entry1!.changeOrders).toHaveLength(2);
      expect(entry1!.changeOrders[0].changeOrderNumber).toBe("CO-1");
      expect(entry1!.changeOrders[0].amountCents).toBe(15000);
      expect(entry1!.changeOrders[1].amountCents).toBe(8000);

      const entry2 = entries.find((e) => e.id === ENTRY_2);
      expect(entry2!.changeOrders).toHaveLength(1);
      expect(entry2!.changeOrders[0].amountCents).toBe(3500);
    });
  });

  describe("Roll-up math with multiple change orders", () => {
    it("computes total billed from job_bids, not from ledger or change orders", async () => {
      const rollup = await getBuilderRollup(BUILDER_ID, "Builder Corp");

      // Total billed = sum of current bid amounts (500000 + 200000)
      expect(rollup.totalBilledCents).toBe(700000);
    });

    it("computes total outstanding from balance_cents", async () => {
      const rollup = await getBuilderRollup(BUILDER_ID, "Builder Corp");

      // Total outstanding = sum of balance_cents (150000 + 0)
      expect(rollup.totalOutstandingCents).toBe(150000);
    });

    it("computes total retainer from retainer_cents", async () => {
      const rollup = await getBuilderRollup(BUILDER_ID, "Builder Corp");

      // Total retainer = sum of retainer_cents (50000 + 25000)
      expect(rollup.totalRetainerCents).toBe(75000);
    });

    it("counts callbacks using the unified callback definition", async () => {
      const rollup = await getBuilderRollup(BUILDER_ID, "Builder Corp");

      // JOB_2 is type "Callback" with status "Scheduled" (not completed/cancelled)
      // so it should count as an open callback
      expect(rollup.callbackCount).toBe(1);
    });

    it("reports correct entry count", async () => {
      const rollup = await getBuilderRollup(BUILDER_ID, "Builder Corp");
      expect(rollup.entryCount).toBe(2);
    });
  });

  describe("Builder overview", () => {
    it("lists only parent customers with child jobs", async () => {
      const builders = await listBuildersWithRollups();

      // Only BUILDER_ID should appear (it has child customers with jobs)
      expect(builders).toHaveLength(1);
      expect(builders[0].customerId).toBe(BUILDER_ID);
      expect(builders[0].customerName).toBe("Builder Corp");
    });

    it("batched overview matches the per-builder rollup exactly", async () => {
      const builders = await listBuildersWithRollups();
      const single = await getBuilderRollup(BUILDER_ID, "Builder Corp");
      expect(builders).toHaveLength(1);
      expect(builders[0]).toEqual(single);
    });

    it("empty when no customers have parent_customer_id", async () => {
      // Override the fake to return no children
      const origFrom = fakeSupabase.from;
      fakeSupabase.from = (table: string) => {
        if (table === "customers") {
          const QueryClass = buildFakeQuery(table, [
            { id: "solo", org_id: ORG_ID, parent_customer_id: null, name: "Solo" },
          ]);
          return new QueryClass();
        }
        return origFrom(table);
      };

      const builders = await listBuildersWithRollups();
      expect(builders).toHaveLength(0);

      // Restore
      fakeSupabase.from = origFrom;
    });
  });

  describe("Open job count (production Title Case statuses)", () => {
    it("counts the default fixture's Title Case open jobs (was 0 with lowercase filter)", async () => {
      const rollup = await getBuilderRollup(BUILDER_ID, "Builder Corp");
      // JOB_1 "In Progress" + JOB_2 "Scheduled"
      expect(rollup.openJobCount).toBe(2);
    });

    it("pins the exact Title Case values production stores", () => {
      const variants = getStatusVariants(GC_OPEN_JOB_STATUSES);
      // Open: these exact strings are what prod jobs.status contains.
      expect(variants).toContain("Scheduled");
      expect(variants).toContain("In Progress");
      expect(variants).toContain("On Hold");
      // Legacy lowercase variants still match.
      expect(variants).toContain("scheduled");
      expect(variants).toContain("in_progress");
      // Closed statuses must never be counted as open.
      expect(variants).not.toContain("Completed");
      expect(variants).not.toContain("Cancelled");
      expect(variants).not.toContain("completed");
      expect(variants).not.toContain("cancelled");
    });

    it("counts Scheduled / In Progress / On Hold across parent + child sites, excluding Completed / Cancelled", async () => {
      const titleCaseJobs: Row[] = [
        { id: "t-1", org_id: ORG_ID, customer_id: CHILD_1, status: "Scheduled" },
        { id: "t-2", org_id: ORG_ID, customer_id: CHILD_1, status: "In Progress" },
        { id: "t-3", org_id: ORG_ID, customer_id: CHILD_2, status: "On Hold" },
        { id: "t-4", org_id: ORG_ID, customer_id: CHILD_2, status: "Completed" },
        { id: "t-5", org_id: ORG_ID, customer_id: CHILD_2, status: "Cancelled" },
        // Job filed directly against the builder parent counts too.
        { id: "t-6", org_id: ORG_ID, customer_id: BUILDER_ID, status: "In Progress" },
        // Legacy lowercase row still counts.
        { id: "t-7", org_id: ORG_ID, customer_id: CHILD_1, status: "scheduled" },
        // Other org / unrelated customer never counts.
        { id: "t-8", org_id: "other-org", customer_id: CHILD_1, status: "Scheduled" },
        { id: "t-9", org_id: ORG_ID, customer_id: "cust-unrelated", status: "Scheduled" },
      ];

      const origFrom = fakeSupabase.from;
      fakeSupabase.from = (table: string) => {
        if (table === "jobs") {
          const QueryClass = buildFakeQuery(table, titleCaseJobs);
          return new QueryClass();
        }
        return origFrom(table);
      };

      try {
        const rollup = await getBuilderRollup(BUILDER_ID, "Builder Corp");
        // t-1, t-2, t-3, t-6, t-7
        expect(rollup.openJobCount).toBe(5);
      } finally {
        fakeSupabase.from = origFrom;
      }
    });
  });
});
