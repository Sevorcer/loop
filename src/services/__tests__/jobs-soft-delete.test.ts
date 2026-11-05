/**
 * Soft-delete & restore job service tests.
 *
 * Verifies:
 * - softDeleteJob hides a job (calls the repo soft-delete function)
 * - restoreJob brings it back (calls the repo restore function)
 * - Tech role cannot soft-delete
 * - Only owner can restore
 * - Activity is recorded on both operations
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getJobByIdMock,
  softDeleteJobMock,
  restoreJobMock,
  createJobActivityMock,
  deleteDispatchPlansByJobIdMock,
  syncCustomerCountersMock,
  syncPropertyCountersMock,
  resolveCustomerIdByNameMock,
  resolvePropertyIdByNameMock,
} = vi.hoisted(() => ({
  getJobByIdMock: vi.fn(),
  softDeleteJobMock: vi.fn(),
  restoreJobMock: vi.fn(),
  createJobActivityMock: vi.fn(),
  deleteDispatchPlansByJobIdMock: vi.fn(),
  syncCustomerCountersMock: vi.fn(),
  syncPropertyCountersMock: vi.fn(),
  resolveCustomerIdByNameMock: vi.fn(),
  resolvePropertyIdByNameMock: vi.fn(),
}));

vi.mock("@/repositories/jobs", () => ({
  getJobById: getJobByIdMock,
  getJobRowById: vi.fn(),
  updateJob: vi.fn(),
  createJobActivity: createJobActivityMock,
  listJobs: vi.fn(),
  listJobActivity: vi.fn(),
  listActivityByJobId: vi.fn(),
  listJobsByCustomerId: vi.fn(),
  listJobsByPropertyId: vi.fn(),
  createJob: vi.fn(),
  deleteJob: vi.fn(),
  softDeleteJob: softDeleteJobMock,
  restoreJob: restoreJobMock,
  countJobs: vi.fn(),
  toJob: vi.fn(),
}));

vi.mock("@/repositories/properties", () => ({
  resolveCustomerIdByName: resolveCustomerIdByNameMock,
}));

vi.mock("@/repositories/dispatch", () => ({
  updateDispatchPlanStatusByJobId: vi.fn(),
  deleteDispatchPlansByJobId: deleteDispatchPlansByJobIdMock,
  createDispatchPlan: vi.fn(),
  deleteDispatchPlansForJobExcept: vi.fn(),
  updateDispatchPlanPlacement: vi.fn(),
  listDispatchPlansByJobId: vi.fn(),
  upsertScheduleBlock: vi.fn(),
}));

vi.mock("@/services/customers", () => ({
  syncCustomerCounters: syncCustomerCountersMock,
}));

vi.mock("@/services/properties", () => ({
  resolvePropertyIdByName: resolvePropertyIdByNameMock,
  syncPropertyCounters: syncPropertyCountersMock,
}));

vi.mock("@/services/installedSystems", () => ({
  getInstalledSystemsSnapshot: vi.fn(),
}));

vi.mock("@/services/currentOperator", () => ({
  getCurrentOperator: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/services/storage", () => ({
  listFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/repositories/jobNotes", () => ({
  insertJobNote: vi.fn(),
  listJobNotes: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/repositories/billing", () => ({
  setBillingEligible: vi.fn(),
}));

vi.mock("@/repositories/contractors", () => ({
  getContractorById: vi.fn(),
}));

const SAMPLE_JOB = {
  id: "job-001",
  jobNumber: "JOB-1001",
  title: "Test Job",
  type: "Install" as const,
  status: "Scheduled" as const,
  priority: "Medium" as const,
  customerId: "cust-001",
  customerName: "Test Customer",
  propertyId: "prop-001",
  propertyName: "Test Property",
  assignedTo: "Tech A",
  contractorIds: [],
  scheduledFor: "2026-11-04",
  appointmentHour: 8 as const,
  scheduledStartAt: null,
  scheduledEndAt: null,
  arrivalWindowStartAt: null,
  arrivalWindowEndAt: null,
  closeoutMode: "full" as const,
  summary: "",
  location: "",
  notes: "",
};

const { softDeleteJob, restoreJob } = await import("@/services/jobs");

describe("softDeleteJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getJobByIdMock.mockResolvedValue(SAMPLE_JOB);
    softDeleteJobMock.mockResolvedValue(true);
    createJobActivityMock.mockResolvedValue({ id: "act-1" });
  });

  it("soft-deletes a job for owner role", async () => {
    const result = await softDeleteJob("job-001", {
      actorId: "user-001",
      role: "owner",
    });

    expect(result).toBe(true);
    expect(softDeleteJobMock).toHaveBeenCalledWith("job-001");
    expect(deleteDispatchPlansByJobIdMock).toHaveBeenCalledWith("job-001");
    expect(createJobActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-001",
        title: "Job deleted",
      }),
    );
  });

  it("soft-deletes a job for manager role", async () => {
    const result = await softDeleteJob("job-001", {
      actorId: "user-002",
      role: "manager",
    });

    expect(result).toBe(true);
    expect(softDeleteJobMock).toHaveBeenCalledWith("job-001");
  });

  it("soft-deletes a job for office role", async () => {
    const result = await softDeleteJob("job-001", {
      actorId: "user-003",
      role: "office",
    });

    expect(result).toBe(true);
    expect(softDeleteJobMock).toHaveBeenCalledWith("job-001");
  });

  it("rejects tech role", async () => {
    await expect(
      softDeleteJob("job-001", { actorId: "user-004", role: "tech" }),
    ).rejects.toThrow("Insufficient permissions");
    expect(softDeleteJobMock).not.toHaveBeenCalled();
  });

  it("rejects sales role", async () => {
    await expect(
      softDeleteJob("job-001", { actorId: "user-005", role: "sales" }),
    ).rejects.toThrow("Insufficient permissions");
    expect(softDeleteJobMock).not.toHaveBeenCalled();
  });

  it("rejects dispatch role", async () => {
    await expect(
      softDeleteJob("job-001", { actorId: "user-006", role: "dispatch" }),
    ).rejects.toThrow("Insufficient permissions");
    expect(softDeleteJobMock).not.toHaveBeenCalled();
  });

  it("returns false when job not found", async () => {
    softDeleteJobMock.mockResolvedValue(false);
    getJobByIdMock.mockResolvedValue(null);

    const result = await softDeleteJob("job-missing", {
      actorId: "user-001",
      role: "owner",
    });

    expect(result).toBe(false);
    expect(createJobActivityMock).not.toHaveBeenCalled();
  });
});

describe("restoreJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreJobMock.mockResolvedValue(true);
    createJobActivityMock.mockResolvedValue({ id: "act-2" });
  });

  it("restores a job for owner role", async () => {
    const result = await restoreJob("job-001", {
      actorId: "user-001",
      role: "owner",
    });

    expect(result).toBe(true);
    expect(restoreJobMock).toHaveBeenCalledWith("job-001");
    expect(createJobActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-001",
        title: "Job restored",
      }),
    );
  });

  it("rejects manager role", async () => {
    await expect(
      restoreJob("job-001", { actorId: "user-002", role: "manager" }),
    ).rejects.toThrow("Insufficient permissions");
    expect(restoreJobMock).not.toHaveBeenCalled();
  });

  it("rejects office role", async () => {
    await expect(
      restoreJob("job-001", { actorId: "user-003", role: "office" }),
    ).rejects.toThrow("Insufficient permissions");
    expect(restoreJobMock).not.toHaveBeenCalled();
  });

  it("rejects tech role", async () => {
    await expect(
      restoreJob("job-001", { actorId: "user-004", role: "tech" }),
    ).rejects.toThrow("Insufficient permissions");
    expect(restoreJobMock).not.toHaveBeenCalled();
  });

  it("returns false only when the job does not exist at all", async () => {
    restoreJobMock.mockResolvedValue(false);
        getJobByIdMock.mockResolvedValue(null);

    const result = await restoreJob("job-missing", {
      actorId: "user-001",
      role: "owner",
    });

    expect(result).toBe(false);
    expect(createJobActivityMock).not.toHaveBeenCalled();
  });

    it("is idempotent: already-active job restores as success, no duplicate activity", async () => {
          // The UPDATE matched nothing because the job was already restored
          // (e.g. a double-tap fired restore twice). The job exists, so the
          // call succeeds without writing a second "Job restored" entry.
          restoreJobMock.mockResolvedValue(false);
          getJobByIdMock.mockResolvedValue({ id: "job-001" });

          const result = await restoreJob("job-001", {
                  actorId: "user-001",
                  role: "owner",
          });

          expect(result).toBe(true);
          expect(createJobActivityMock).not.toHaveBeenCalled();
    });
});
