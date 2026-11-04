/**
 * Billing service tests — ready-to-bill lifecycle.
 *
 * Covers: billing status transitions, go-live filter, type filtering,
 * reversibility of mark-billed and exclude.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  listReadyToBillJobsMock,
  markJobBilledMock,
  unmarkJobBilledMock,
  excludeJobFromBillingMock,
  unexcludeJobFromBillingMock,
} = vi.hoisted(() => ({
  listReadyToBillJobsMock: vi.fn(),
  markJobBilledMock: vi.fn(),
  unmarkJobBilledMock: vi.fn(),
  excludeJobFromBillingMock: vi.fn(),
  unexcludeJobFromBillingMock: vi.fn(),
}));

vi.mock("@/repositories/billing", () => ({
  listReadyToBillJobs: listReadyToBillJobsMock,
  markJobBilled: markJobBilledMock,
  unmarkJobBilled: unmarkJobBilledMock,
  excludeJobFromBilling: excludeJobFromBillingMock,
  unexcludeJobFromBilling: unexcludeJobFromBillingMock,
}));

// Import after mocks
const { getReadyToBillJobs, markBilled, unmarkBilled, excludeFromBilling, unexcludeFromBilling } =
  await import("@/services/billing");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBillingJob(overrides = {}) {
  return {
    id: "job-1",
    jobNumber: "JOB-1050",
    customerName: "Test Customer",
    propertyName: "123 Main St",
    type: "Install" as const,
    completedAt: "2026-11-10T18:00:00Z",
    billingStatus: "unbilled" as const,
    qbInvoiceNumber: null,
    billedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── List tests ────────────────────────────────────────────────────────────────

describe("getReadyToBillJobs", () => {
  it("fetches Install jobs", async () => {
    const jobs = [makeBillingJob({ type: "Install" })];
    listReadyToBillJobsMock.mockResolvedValue(jobs);

    const result = await getReadyToBillJobs("Install");

    expect(listReadyToBillJobsMock).toHaveBeenCalledWith("Install");
    expect(result).toEqual(jobs);
  });

  it("fetches Service jobs separately", async () => {
    const jobs = [makeBillingJob({ type: "Service" })];
    listReadyToBillJobsMock.mockResolvedValue(jobs);

    const result = await getReadyToBillJobs("Service");

    expect(listReadyToBillJobsMock).toHaveBeenCalledWith("Service");
    expect(result).toEqual(jobs);
  });

  it("returns empty array when no jobs are ready", async () => {
    listReadyToBillJobsMock.mockResolvedValue([]);

    const result = await getReadyToBillJobs("Install");

    expect(result).toEqual([]);
  });
});

// ── Mark billed tests ─────────────────────────────────────────────────────────

describe("markBilled", () => {
  it("marks a job billed with invoice number and date", async () => {
    markJobBilledMock.mockResolvedValue(true);

    const result = await markBilled(
      { jobId: "job-1", qbInvoiceNumber: "INV-001", billedAt: "2026-11-14" },
      "user-1",
    );

    expect(markJobBilledMock).toHaveBeenCalledWith("job-1", "INV-001", "2026-11-14", "user-1");
    expect(result).toBe(true);
  });

  it("rejects empty invoice number", async () => {
    await expect(
      markBilled({ jobId: "job-1", qbInvoiceNumber: "", billedAt: "2026-11-14" }, "user-1"),
    ).rejects.toThrow("QuickBooks invoice number is required.");
  });

  it("rejects empty billed date", async () => {
    await expect(
      markBilled({ jobId: "job-1", qbInvoiceNumber: "INV-001", billedAt: "" }, "user-1"),
    ).rejects.toThrow("Billed date is required.");
  });
});

// ── Unmark billed (reversibility) ─────────────────────────────────────────────

describe("unmarkBilled", () => {
  it("un-marks a billed job, returning it to the list", async () => {
    unmarkJobBilledMock.mockResolvedValue(true);

    const result = await unmarkBilled("job-1");

    expect(unmarkJobBilledMock).toHaveBeenCalledWith("job-1");
    expect(result).toBe(true);
  });
});

// ── Exclude / un-exclude ──────────────────────────────────────────────────────

describe("excludeFromBilling", () => {
  it("excludes a job from the billing list", async () => {
    excludeJobFromBillingMock.mockResolvedValue(true);

    const result = await excludeFromBilling("job-1");

    expect(excludeJobFromBillingMock).toHaveBeenCalledWith("job-1");
    expect(result).toBe(true);
  });
});

describe("unexcludeFromBilling", () => {
  it("un-excludes a job, returning it to the list", async () => {
    unexcludeJobFromBillingMock.mockResolvedValue(true);

    const result = await unexcludeFromBilling("job-1");

    expect(unexcludeJobFromBillingMock).toHaveBeenCalledWith("job-1");
    expect(result).toBe(true);
  });
});

// ── Go-live hygiene ───────────────────────────────────────────────────────────

describe("go-live hygiene", () => {
  it("repository query filters on billing_eligible = true (historical jobs excluded)", async () => {
    // The repository query itself filters on billing_eligible = true.
    // Historical jobs have billing_eligible = false (migration default),
    // so they never appear. We verify the service passes through to the
    // repository without altering the filter.
    listReadyToBillJobsMock.mockResolvedValue([]);

    await getReadyToBillJobs("Install");

    // The repository is called with just the type — the billing_eligible
    // filter is baked into the repository query itself.
    expect(listReadyToBillJobsMock).toHaveBeenCalledWith("Install");
  });
});
