/**
 * Job-number allocation retry: jobs service (review item B11).
 *
 * createJob allocates the next number as MAX(JOB-<n>) + 1. Two concurrent
 * creates can read the same MAX and race to insert the same JOB-<n>; the loser
 * trips the jobs_job_number_unique index. The service must catch that specific
 * unique violation and retry with the NEXT number (bounded) rather than
 * surfacing the error. A unique violation on any other constraint must NOT be
 * retried.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/services/inventoryReservations", () => ({ releaseAndRecheck: vi.fn(async () => undefined) }));

const {
  getMaxJobNumberSuffixMock,
  createJobRecordMock,
  createJobActivityMock,
  syncCustomerCountersMock,
  syncPropertyCountersMock,
} = vi.hoisted(() => ({
  getMaxJobNumberSuffixMock: vi.fn(),
  createJobRecordMock: vi.fn(),
  createJobActivityMock: vi.fn(),
  syncCustomerCountersMock: vi.fn(),
  syncPropertyCountersMock: vi.fn(),
}));

// Faithful copy of the repository predicate so the service's detection path is
// exercised against realistic error shapes (the module is mocked below).
function isJobNumberUniqueViolationImpl(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  const mentionsJobNumber =
    message.includes("job_number") || message.includes("jobs_job_number_unique");
  if (!mentionsJobNumber) return false;
  return code === "23505" || message.includes("duplicate key");
}

vi.mock("@/repositories/jobs", () => ({
  getMaxJobNumberSuffix: getMaxJobNumberSuffixMock,
  isJobNumberUniqueViolation: isJobNumberUniqueViolationImpl,
  createJob: createJobRecordMock,
  createJobActivity: createJobActivityMock,
  getJobById: vi.fn(),
  getJobRowById: vi.fn(),
  updateJob: vi.fn(),
  deleteJob: vi.fn(),
  countUnscheduledJobs: vi.fn(),
  listActivityByJobId: vi.fn(),
  listJobActivity: vi.fn(),
  listJobs: vi.fn(),
  listJobsByCustomerId: vi.fn(),
  listJobsByPropertyId: vi.fn(),
  listJobsForDispatch: vi.fn(),
  listJobsInRange: vi.fn(),
  listRecentJobs: vi.fn(),
  toJob: vi.fn(),
}));

vi.mock("@/repositories/properties", () => ({
  resolveCustomerIdByName: vi.fn(),
}));

vi.mock("@/repositories/dispatch", () => ({
  createDispatchPlan: vi.fn(),
  deleteDispatchPlansByJobId: vi.fn(),
  deleteDispatchPlansForJobExcept: vi.fn(),
  updateDispatchPlanStatusByJobId: vi.fn(),
  listDispatchPlansByJobId: vi.fn().mockResolvedValue({ ok: false, data: [] }),
  updateDispatchPlanPlacement: vi.fn(),
  upsertScheduleBlock: vi.fn(),
}));

vi.mock("@/repositories/contractors", () => ({
  getContractorById: vi.fn(),
}));

vi.mock("@/services/customers", () => ({
  syncCustomerCounters: syncCustomerCountersMock,
}));

vi.mock("@/services/properties", () => ({
  resolvePropertyIdByName: vi.fn(),
  syncPropertyCounters: syncPropertyCountersMock,
}));

vi.mock("@/services/installedSystems", () => ({
  getInstalledSystemsSnapshot: vi.fn(),
}));

vi.mock("@/services/currentOperator", () => ({
  getCurrentOperator: vi.fn(),
}));

vi.mock("@/services/storage", () => ({
  listFiles: vi.fn(),
}));

vi.mock("@/repositories/jobNotes", () => ({
  insertJobNote: vi.fn(),
  listJobNotes: vi.fn(),
}));

import { createJob } from "@/services/jobs";

function uniqueViolation(message: string) {
  const error = new Error(message) as Error & { code?: string };
  error.code = "23505";
  return error;
}

function jobRow(jobNumber: string) {
  return {
    id: `job-${jobNumber}`,
    jobNumber,
    type: "Service",
    status: "Scheduled",
    assignedTo: "",
    scheduledStartAt: null,
    scheduledFor: null,
    notes: "",
  };
}

const baseInput = {
  title: "Replace condenser",
  type: "Service" as const,
  priority: "Medium" as const,
  customerId: "cust-1",
  customerName: "Acme",
  propertyId: "prop-1",
  propertyName: "HQ",
  assignedTo: "",
  location: "North wall",
  summary: "Condenser swap",
  notes: "",
  scheduledStartAt: null,
  scheduledEndAt: null,
  arrivalWindowStartAt: null,
  arrivalWindowEndAt: null,
  scheduledFor: null,
};

describe("createJob job-number allocation retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createJobActivityMock.mockResolvedValue({ id: "activity-1" });
    syncCustomerCountersMock.mockResolvedValue(undefined);
    syncPropertyCountersMock.mockResolvedValue(undefined);
  });

  it("retries with the NEXT number on a job_number unique violation", async () => {
    getMaxJobNumberSuffixMock.mockResolvedValue(1019); // next = JOB-1020
    const attempted: string[] = [];
    createJobRecordMock.mockImplementation(async (jobNumber: string) => {
      attempted.push(jobNumber);
      if (jobNumber !== "JOB-1021") {
        throw uniqueViolation('duplicate key value violates unique constraint "jobs_job_number_unique"');
      }
      return jobRow(jobNumber);
    });

    const created = await createJob(baseInput);

    expect(attempted).toEqual(["JOB-1020", "JOB-1021"]);
    expect(created.jobNumber).toBe("JOB-1021");
  });

  it("does NOT retry on a unique violation for a different constraint", async () => {
    getMaxJobNumberSuffixMock.mockResolvedValue(1019);
    const attempted: string[] = [];
    createJobRecordMock.mockImplementation(async (jobNumber: string) => {
      attempted.push(jobNumber);
      throw uniqueViolation('duplicate key value violates unique constraint "jobs_estimate_id_key"');
    });

    await expect(createJob(baseInput)).rejects.toThrow(/jobs_estimate_id_key/);
    expect(attempted).toEqual(["JOB-1020"]); // one attempt, no retry
  });

  it("gives up after a bounded number of retries and rethrows", async () => {
    getMaxJobNumberSuffixMock.mockResolvedValue(1019);
    const attempted: string[] = [];
    createJobRecordMock.mockImplementation(async (jobNumber: string) => {
      attempted.push(jobNumber);
      throw uniqueViolation('duplicate key value violates unique constraint "jobs_job_number_unique"');
    });

    await expect(createJob(baseInput)).rejects.toThrow(/jobs_job_number_unique/);
    // attempts are bounded (initial + retries), not infinite.
    expect(attempted.length).toBe(26); // 1 initial + 25 retries
    expect(attempted[0]).toBe("JOB-1020");
    expect(attempted[attempted.length - 1]).toBe("JOB-1045");
  });

  it("allocates MAX+1 with no retry when the first number is free", async () => {
    getMaxJobNumberSuffixMock.mockResolvedValue(1041); // next = JOB-1042
    const attempted: string[] = [];
    createJobRecordMock.mockImplementation(async (jobNumber: string) => {
      attempted.push(jobNumber);
      return jobRow(jobNumber);
    });

    const created = await createJob(baseInput);

    expect(attempted).toEqual(["JOB-1042"]);
    expect(created.jobNumber).toBe("JOB-1042");
  });
});
