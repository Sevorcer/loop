/**
 * S6 — Job lifecycle guardrails: service-level transition tests
 *
 * Verifies that updateJobStatus enforces the transition matrix and records
 * activity with from/to status context.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getJobByIdMock,
  updateJobMock,
  createJobActivityMock,
  resolveCustomerIdByNameMock,
  resolvePropertyIdByNameMock,
  syncCustomerCountersMock,
  syncPropertyCountersMock,
} = vi.hoisted(() => ({
  getJobByIdMock: vi.fn(),
  updateJobMock: vi.fn(),
  createJobActivityMock: vi.fn(),
  resolveCustomerIdByNameMock: vi.fn(),
  resolvePropertyIdByNameMock: vi.fn(),
  syncCustomerCountersMock: vi.fn(),
  syncPropertyCountersMock: vi.fn(),
}));

vi.mock("@/repositories/jobs", () => ({
  getJobById: getJobByIdMock,
  getJobRowById: vi.fn(),
  updateJob: updateJobMock,
  createJobActivity: createJobActivityMock,
  listJobs: vi.fn(),
  listJobActivity: vi.fn(),
  listActivityByJobId: vi.fn(),
  listJobsByCustomerId: vi.fn(),
  listJobsByPropertyId: vi.fn(),
  createJob: vi.fn(),
  deleteJob: vi.fn(),
  countJobs: vi.fn(),
  toJob: vi.fn(),
}));

vi.mock("@/repositories/properties", () => ({
  resolveCustomerIdByName: resolveCustomerIdByNameMock,
}));

vi.mock("@/services/customers", () => ({
  syncCustomerCounters: syncCustomerCountersMock,
}));

vi.mock("@/services/properties", () => ({
  resolvePropertyIdByName: resolvePropertyIdByNameMock,
  syncPropertyCounters: syncPropertyCountersMock,
}));

import { updateJobStatus } from "@/services/jobs";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<{ status: string }> = {}) {
  return {
    id: "job-001",
    jobNumber: "JOB-1001",
    title: "Install HVAC",
    type: "Install",
    status: "Scheduled",
    priority: "Medium",
    customerName: "Acme Corp",
    propertyName: "Acme HQ",
    assignedTo: "Tech A",
    scheduledFor: "2026-08-01",
    summary: "Summary",
    location: "123 Main St",
    notes: "",
    ...overrides,
  };
}

// ─── updateJobStatus — invalid transition guard ────────────────────────────────

describe("updateJobStatus — invalid transition guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws with a clear message when transitioning from a terminal state (Completed → In Progress)", async () => {
    getJobByIdMock.mockResolvedValue(makeJob({ status: "Completed" }));

    await expect(updateJobStatus("job-001", "In Progress")).rejects.toThrow(
      /Invalid transition.*Completed.*In Progress/i,
    );
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("throws when transitioning from a terminal state (Cancelled → Scheduled)", async () => {
    getJobByIdMock.mockResolvedValue(makeJob({ status: "Cancelled" }));

    await expect(updateJobStatus("job-001", "Scheduled")).rejects.toThrow(
      /Invalid transition.*Cancelled.*Scheduled/i,
    );
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("throws when skipping a required step (Scheduled → Completed)", async () => {
    getJobByIdMock.mockResolvedValue(makeJob({ status: "Scheduled" }));

    await expect(updateJobStatus("job-001", "Completed")).rejects.toThrow(
      /Invalid transition.*Scheduled.*Completed/i,
    );
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("throws for an unknown status value before touching the DB", async () => {
    await expect(
      // @ts-expect-error — intentional bad input
      updateJobStatus("job-001", "Unknown"),
    ).rejects.toThrow(/invalid job status/i);
    expect(getJobByIdMock).not.toHaveBeenCalled();
  });

  it("returns null when job does not exist", async () => {
    getJobByIdMock.mockResolvedValue(null);

    const result = await updateJobStatus("job-404", "In Progress");
    expect(result).toBeNull();
    expect(updateJobMock).not.toHaveBeenCalled();
  });
});

// ─── updateJobStatus — valid transitions ──────────────────────────────────────

describe("updateJobStatus — valid transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCustomerIdByNameMock.mockResolvedValue(null);
    resolvePropertyIdByNameMock.mockResolvedValue(null);
    syncCustomerCountersMock.mockResolvedValue(undefined);
    syncPropertyCountersMock.mockResolvedValue(undefined);
    createJobActivityMock.mockResolvedValue({ id: "act-1" });
  });

  it("Scheduled → In Progress succeeds and logs status change", async () => {
    const original = makeJob({ status: "Scheduled" });
    const updated = makeJob({ status: "In Progress" });
    getJobByIdMock.mockResolvedValue(original);
    updateJobMock.mockResolvedValue(updated);

    const result = await updateJobStatus("job-001", "In Progress");

    expect(result).toEqual(updated);
    expect(updateJobMock).toHaveBeenCalledWith("job-001", { status: "In Progress" });
    expect(createJobActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-001",
        type: "status",
        description: expect.stringContaining("Scheduled"),
      }),
    );
    expect(createJobActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("In Progress"),
      }),
    );
  });

  it("In Progress → Completed succeeds", async () => {
    const original = makeJob({ status: "In Progress" });
    const updated = makeJob({ status: "Completed" });
    getJobByIdMock.mockResolvedValue(original);
    updateJobMock.mockResolvedValue(updated);

    const result = await updateJobStatus("job-001", "Completed");
    expect(result).toEqual(updated);
    expect(updateJobMock).toHaveBeenCalledWith("job-001", { status: "Completed" });
  });

  it("On Hold → Scheduled succeeds (return to queue)", async () => {
    const original = makeJob({ status: "On Hold" });
    const updated = makeJob({ status: "Scheduled" });
    getJobByIdMock.mockResolvedValue(original);
    updateJobMock.mockResolvedValue(updated);

    const result = await updateJobStatus("job-001", "Scheduled");
    expect(result).toEqual(updated);
  });
});
