/**
 * GC Portal v2 tests — verify toggle gating and new sections.
 *
 * Tests that:
 * 1. When portal_money_visible=false: money, estimate, billing are OMITTED from response
 * 2. When portal_photos_visible=false: photos are empty
 * 3. Change order amounts are omitted when money not visible
 * 4. New sections (permits, inspections, progressTimeline) are present
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Admin client mock ──────────────────────────────────────────────────────

const fromResults: Record<string, { data: unknown; error: unknown }> = {};

function setFromResult(table: string, data: unknown, error: unknown = null) {
  fromResults[table] = { data, error };
}

function chainable(resolvedValue: { data: unknown; error: unknown }) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        // Make it thenable
        const promise = Promise.resolve(resolvedValue);
        return (promise as Record<string | symbol, unknown>)[prop];
      }
      // All methods return chainable proxy
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

const adminMock = {
  from: vi.fn((table: string) => {
    const result = fromResults[table] ?? { data: null, error: null };
    return chainable(result);
  }),
};

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => adminMock,
}));

import { getPortalJobData } from "../portalJobData";
import type { PortalJobData } from "../portalJobData";

// ─── Setup ────────────────────────────────────────────────────────────────────

const JOB_ID = "job-v2-test";
const ORG_ID = "org-v2-test";

function setupBasicJob(overrides: Record<string, unknown> = {}) {
  // Reset
  for (const key of Object.keys(fromResults)) {
    delete fromResults[key];
  }

  const jobData = {
    id: JOB_ID,
    job_number: "V2-001",
    status: "Scheduled",
    type: "Install",
    scheduled_for: "2026-12-15",
    property_id: null,
    customer_id: null,
    portal_money_visible: false,
    portal_photos_visible: false,
    ...overrides,
  };

  setFromResult("jobs", jobData);
  setFromResult("job_assignees", []);
  setFromResult("job_activity", []);
  setFromResult("storage_objects", []);
  setFromResult("job_permits", []);
  setFromResult("job_inspections", []);
  setFromResult("inspection_corrections", [], null);
  setFromResult("job_change_orders", []);
  setFromResult("gc_ledger_entries", null);
  setFromResult("job_bids", null);
  setFromResult("job_financials", null);
  setFromResult("payments", []);
  setFromResult("properties", null);
  setFromResult("customers", null);
  setFromResult("user_profiles", null);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("portalJobData v2 — toggle gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBasicJob();
  });

  it("omits money, estimate, and billing when portal_money_visible=false", async () => {
    setupBasicJob({ portal_money_visible: false });

    const result = await getPortalJobData(JOB_ID, ORG_ID);

    expect(result).not.toBeNull();
    const data = result as PortalJobData;
    expect(data.money).toBeUndefined();
    expect(data.estimate).toBeUndefined();
    expect(data.billing).toBeUndefined();
  });

  it("includes money, billing when portal_money_visible=true", async () => {
    setupBasicJob({ portal_money_visible: true });

    const result = await getPortalJobData(JOB_ID, ORG_ID);

    expect(result).not.toBeNull();
    const data = result as PortalJobData;
    // money should be defined even if ledger entry is null (empty structure)
    expect(data.money).toBeDefined();
    expect(data.billing).toBeDefined();
  });

  it("returns empty photos when portal_photos_visible=false", async () => {
    setupBasicJob({ portal_photos_visible: false });

    const result = await getPortalJobData(JOB_ID, ORG_ID);

    expect(result).not.toBeNull();
    const data = result as PortalJobData;
    expect(data.photos).toEqual([]);
  });

  it("change order amounts omitted when money not visible", async () => {
    setupBasicJob({ portal_money_visible: false });
    setFromResult("job_change_orders", [
      { id: "co-1", title: "Add ductwork", status: "approved", amount_cents: 15000 },
    ]);

    const result = await getPortalJobData(JOB_ID, ORG_ID);

    expect(result).not.toBeNull();
    const data = result as PortalJobData;
    expect(data.changeOrders).toHaveLength(1);
    expect(data.changeOrders[0].title).toBe("Add ductwork");
    expect(data.changeOrders[0].status).toBe("approved");
    // amountCents should NOT be present
    expect(data.changeOrders[0].amountCents).toBeUndefined();
  });

  it("change order amounts included when money visible", async () => {
    setupBasicJob({ portal_money_visible: true });
    setFromResult("job_change_orders", [
      { id: "co-1", title: "Add ductwork", status: "approved", amount_cents: 15000 },
    ]);

    const result = await getPortalJobData(JOB_ID, ORG_ID);

    expect(result).not.toBeNull();
    const data = result as PortalJobData;
    expect(data.changeOrders).toHaveLength(1);
    expect(data.changeOrders[0].amountCents).toBe(15000);
  });
});

describe("portalJobData v2 — new sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBasicJob();
  });

  it("returns permits array in response", async () => {
    const result = await getPortalJobData(JOB_ID, ORG_ID);
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.permits)).toBe(true);
  });

  it("returns inspections array in response", async () => {
    const result = await getPortalJobData(JOB_ID, ORG_ID);
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.inspections)).toBe(true);
  });

  it("returns progressTimeline with Scheduled/In Progress/Completed milestones", async () => {
    const result = await getPortalJobData(JOB_ID, ORG_ID);
    expect(result).not.toBeNull();
    expect(result!.progressTimeline).toHaveLength(3);
    expect(result!.progressTimeline.map((m) => m.label)).toEqual([
      "Scheduled",
      "In Progress",
      "Completed",
    ]);
  });

  it("returns changeOrders array in response", async () => {
    const result = await getPortalJobData(JOB_ID, ORG_ID);
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.changeOrders)).toBe(true);
  });
});
