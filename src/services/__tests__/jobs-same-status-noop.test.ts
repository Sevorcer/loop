/**
 * P1 regression lock — same-status no-op
 *
 * updateJobStatus must treat a same-status call (e.g. In Progress -> In Progress)
 * as a harmless no-op: return the existing job and sync the dispatch plan. It must
 * NEVER throw "Invalid transition."
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/services/inventoryReservations", () => ({ releaseAndRecheck: vi.fn(async () => undefined) }));

const {
  getJobByIdMock,
  updateJobMock,
  createJobActivityMock,
  updateDispatchPlanStatusByJobIdMock,
} = vi.hoisted(() => ({
  getJobByIdMock: vi.fn(),
  updateJobMock: vi.fn(),
  createJobActivityMock: vi.fn(),
  updateDispatchPlanStatusByJobIdMock: vi.fn(),
}));

vi.mock("@/repositories/jobs", () => ({
  getJobById: getJobByIdMock,
  getJobRowById: vi.fn(),
  updateJob: updateJobMock,
  createJobActivity: createJobActivityMock,
  listJobs: vi.fn(),
  listJobActivity: vi.fn(),
  listActivityByJobId: vi.fn().mockResolvedValue([]),
  listJobsByCustomerId: vi.fn(),
  listJobsByPropertyId: vi.fn(),
  createJob: vi.fn(),
  deleteJob: vi.fn(),
  countJobs: vi.fn(),
  toJob: vi.fn(),
}));

vi.mock("@/repositories/properties", () => ({
  resolveCustomerIdByName: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/repositories/dispatch", () => ({
  updateDispatchPlanStatusByJobId: updateDispatchPlanStatusByJobIdMock,
}));

vi.mock("@/services/customers", () => ({
  syncCustomerCounters: vi.fn(),
}));

vi.mock("@/services/properties", () => ({
  resolvePropertyIdByName: vi.fn().mockResolvedValue(null),
  syncPropertyCounters: vi.fn(),
}));

vi.mock("@/services/storage", () => ({
  listFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/installedSystems", () => ({
  getInstalledSystemsSnapshot: vi.fn().mockResolvedValue({
    installedSystems: [],
    technicalProfiles: [],
  }),
}));

vi.mock("@/repositories/jobNotes", () => ({
  listJobNotes: vi.fn(async () => []),
  insertJobNote: vi.fn(),
}));

vi.mock("@/repositories/billing", () => ({
  setBillingEligible: vi.fn(),
}));

import { updateJobStatus } from "@/services/jobs";

function makeJob(overrides: Record<string, unknown> = {}) {
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

describe("updateJobStatus — same-status is a no-op (P1 regression lock)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("In Progress -> In Progress returns the job without throwing", async () => {
    const existing = makeJob({ status: "In Progress" });
    getJobByIdMock.mockResolvedValue(existing);
    updateDispatchPlanStatusByJobIdMock.mockResolvedValue({ ok: true, data: [] });

    const result = await updateJobStatus("job-001", "In Progress");
    expect(result).toEqual(existing);
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("In Progress -> In Progress syncs the dispatch plan", async () => {
    const existing = makeJob({ status: "In Progress" });
    getJobByIdMock.mockResolvedValue(existing);
    updateDispatchPlanStatusByJobIdMock.mockResolvedValue({ ok: true, data: [] });

    await updateJobStatus("job-001", "In Progress");
    expect(updateDispatchPlanStatusByJobIdMock).toHaveBeenCalledWith(
      "job-001",
      "in_progress",
      expect.any(String),
    );
  });

  it("Scheduled -> Scheduled returns the job without throwing", async () => {
    const existing = makeJob({ status: "Scheduled" });
    getJobByIdMock.mockResolvedValue(existing);

    const result = await updateJobStatus("job-001", "Scheduled");
    expect(result).toEqual(existing);
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("Completed -> Completed syncs dispatch plan as completed", async () => {
    const existing = makeJob({ status: "Completed" });
    getJobByIdMock.mockResolvedValue(existing);
    updateDispatchPlanStatusByJobIdMock.mockResolvedValue({ ok: true, data: [] });

    const result = await updateJobStatus("job-001", "Completed");
    expect(result).toEqual(existing);
    expect(updateJobMock).not.toHaveBeenCalled();
    expect(updateDispatchPlanStatusByJobIdMock).toHaveBeenCalledWith(
      "job-001",
      "completed",
      expect.any(String),
    );
  });

  it("same-status call never reaches the transition guard", async () => {
    const existing = makeJob({ status: "Completed" });
    getJobByIdMock.mockResolvedValue(existing);
    updateDispatchPlanStatusByJobIdMock.mockResolvedValue({ ok: true, data: [] });

    await expect(
      updateJobStatus("job-001", "Completed"),
    ).resolves.toBeDefined();
  });
});
