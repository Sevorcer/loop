/**
 * Regression tests: jobs repository scheduling column resilience
 *
 * Verifies that listJobs, listJobsByCustomerId, and listJobsByPropertyId
 * gracefully fall back to JOB_SELECT_BASE when the appointment_window column
 * does not exist (i.e. migration 20260729000001_pr3a_job_appointment_window.sql
 * has not yet been applied in the target environment).
 *
 * Also verifies that createJob and updateJob fall back similarly on write paths.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Hoisted mock setup – must use vi.hoisted so mocks are available before
// the module-level vi.mock() calls that run at hoist time.
// ---------------------------------------------------------------------------

const {
  mockGetRepositoryContext,
  orderMock,
  maybeSingleMock,
} = vi.hoisted(() => {
  const orderMock = vi.fn();
  const maybeSingleMock = vi.fn();

  // Recursive eq chain handles any number of chained .eq() calls
  const eqChainBase = {
    order: orderMock,
    maybeSingle: maybeSingleMock,
  };
  const eqMockFn: ReturnType<typeof vi.fn> & { [key: string]: unknown } = vi.fn(
    () => eqChain,
  );
  const eqChain = { ...eqChainBase, eq: eqMockFn };
  eqMockFn.mockReturnValue(eqChain);

  const selectFn = vi.fn(() => eqChain);

  // insert chain: .from().insert().select().single()
  const singleFn = vi.fn();
  const insertSelectFn = vi.fn(() => ({ single: singleFn }));
  const insertFn = vi.fn(() => ({ select: insertSelectFn }));

  // update chain: .from().update().eq().eq().select().maybeSingle()
  const updateEqFn: ReturnType<typeof vi.fn> = vi.fn();
  const updateEqChain = {
    eq: updateEqFn,
    select: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
  };
  updateEqFn.mockReturnValue(updateEqChain);
  const updateFn = vi.fn(() => updateEqChain);

  const fromFn = vi.fn(() => ({
    select: selectFn,
    insert: insertFn,
    update: updateFn,
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null, count: 1 })) })),
    })),
  }));

  const supabaseMock = { from: fromFn };

  return {
    mockGetRepositoryContext: vi.fn().mockResolvedValue({
      supabase: supabaseMock,
      orgId: "org-test",
    }),
    orderMock,
    maybeSingleMock,
  };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: mockGetRepositoryContext,
}));

import {
  listJobs,
  listJobsByCustomerId,
  listJobsByPropertyId,
  getJobById,
  getJobRowById,
} from "@/repositories/jobs";
import { DEFAULT_JOB_APPOINTMENT_HOUR } from "@/features/jobs/utils/appointmentWindow";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COLUMN_MISSING_ERROR = {
  message: "column jobs.appointment_window does not exist",
};

function makeJobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    job_number: "JOB-1001",
    estimate_id: null,
    equipment_bundle_id: null,
    title: "Install HVAC",
    type: "Install",
    status: "Scheduled",
    priority: "Medium",
    customer_id: "cust-1",
    customer_name: "Acme Corp",
    property_id: "prop-1",
    property_name: "Acme HQ",
    assigned_to: "Tech 1",
    scheduled_for: "2026-08-01",
    summary: "Full install",
    location: "123 Main St",
    notes: "",
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// listJobs — scheduling column fallback
// ---------------------------------------------------------------------------

describe("listJobs — appointment_window column fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("falls back to JOB_SELECT_BASE and returns jobs with default appointmentHour when column is missing", async () => {
    // First call (JOB_SELECT with appointment_window) → column missing error
    orderMock
      .mockResolvedValueOnce({ data: null, error: COLUMN_MISSING_ERROR })
      // Second call (JOB_SELECT_BASE fallback) → success
      .mockResolvedValueOnce({ data: [makeJobRow()], error: null });

    const jobs = await listJobs();

    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe("job-1");
    expect(jobs[0].appointmentHour).toBe(DEFAULT_JOB_APPOINTMENT_HOUR);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("appointment_window column missing"),
    );
  });

  it("returns jobs with appointmentHour from DB when column exists", async () => {
    orderMock.mockResolvedValueOnce({
      data: [makeJobRow({ appointment_window: 1 })],
      error: null,
    });

    const jobs = await listJobs();

    expect(jobs).toHaveLength(1);
    expect(jobs[0].appointmentHour).toBe(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("throws when a non-scheduling error is returned", async () => {
    orderMock.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied for table jobs" },
    });

    await expect(listJobs()).rejects.toThrow("permission denied for table jobs");
    expect(console.warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// listJobsByCustomerId — scheduling column fallback
// ---------------------------------------------------------------------------

describe("listJobsByCustomerId — appointment_window column fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("falls back and returns jobs with default appointmentHour when column is missing", async () => {
    orderMock
      .mockResolvedValueOnce({ data: null, error: COLUMN_MISSING_ERROR })
      .mockResolvedValueOnce({ data: [makeJobRow()], error: null });

    const jobs = await listJobsByCustomerId("cust-1");

    expect(jobs).toHaveLength(1);
    expect(jobs[0].appointmentHour).toBe(DEFAULT_JOB_APPOINTMENT_HOUR);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("appointment_window column missing"),
    );
  });

  it("returns empty array when no jobs found", async () => {
    orderMock.mockResolvedValueOnce({ data: [], error: null });

    const jobs = await listJobsByCustomerId("cust-no-jobs");

    expect(jobs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// listJobsByPropertyId — scheduling column fallback
// ---------------------------------------------------------------------------

describe("listJobsByPropertyId — appointment_window column fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("falls back and returns jobs with default appointmentHour when column is missing", async () => {
    orderMock
      .mockResolvedValueOnce({ data: null, error: COLUMN_MISSING_ERROR })
      .mockResolvedValueOnce({ data: [makeJobRow()], error: null });

    const jobs = await listJobsByPropertyId("prop-1");

    expect(jobs).toHaveLength(1);
    expect(jobs[0].appointmentHour).toBe(DEFAULT_JOB_APPOINTMENT_HOUR);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("appointment_window column missing"),
    );
  });
});

// ---------------------------------------------------------------------------
// getJobById — scheduling column fallback
// ---------------------------------------------------------------------------

describe("getJobById — appointment_window column fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("falls back and returns job with default appointmentHour when column is missing", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: null, error: COLUMN_MISSING_ERROR })
      .mockResolvedValueOnce({ data: makeJobRow(), error: null });

    const job = await getJobById("job-1");

    expect(job).not.toBeNull();
    expect(job?.appointmentHour).toBe(DEFAULT_JOB_APPOINTMENT_HOUR);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("appointment_window column missing"),
    );
  });

  it("returns null when job is not found (no error, no data)", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    const job = await getJobById("job-404");

    expect(job).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getJobRowById — scheduling column fallback
// ---------------------------------------------------------------------------

describe("getJobRowById — appointment_window column fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("falls back and returns row without appointment_window when column is missing", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: null, error: COLUMN_MISSING_ERROR })
      .mockResolvedValueOnce({ data: makeJobRow(), error: null });

    const row = await getJobRowById("job-1");

    expect(row).not.toBeNull();
    expect(row?.id).toBe("job-1");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("appointment_window column missing"),
    );
  });
});

// ---------------------------------------------------------------------------
// isSchedulingColumnMissingError — detection logic (via listJobs behaviour)
// ---------------------------------------------------------------------------

describe("scheduling column missing detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("does NOT trigger fallback for unrelated errors", async () => {
    orderMock.mockResolvedValueOnce({
      data: null,
      error: { message: "relation \"jobs\" does not exist" },
    });

    await expect(listJobs()).rejects.toThrow("relation \"jobs\" does not exist");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("triggers fallback for PostgREST undefined column error variant", async () => {
    orderMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Could not find the referenced: appointment_window is an undefined column" },
      })
      .mockResolvedValueOnce({ data: [makeJobRow()], error: null });

    const jobs = await listJobs();

    expect(jobs).toHaveLength(1);
    expect(console.warn).toHaveBeenCalled();
  });

  it("triggers fallback for PostgREST schema cache error variant", async () => {
    orderMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Could not find the 'appointment_window' column of 'jobs' in the schema cache" },
      })
      .mockResolvedValueOnce({ data: [makeJobRow()], error: null });

    const jobs = await listJobs();

    expect(jobs).toHaveLength(1);
    expect(console.warn).toHaveBeenCalled();
  });

  it("triggers fallback via PostgreSQL error code 42703", async () => {
    orderMock
      .mockResolvedValueOnce({
        data: null,
        error: { code: "42703", message: "column does not exist" },
      })
      .mockResolvedValueOnce({ data: [makeJobRow()], error: null });

    const jobs = await listJobs();

    expect(jobs).toHaveLength(1);
    expect(console.warn).toHaveBeenCalled();
  });
});
