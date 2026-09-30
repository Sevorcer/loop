import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getJobByIdMock,
  updateJobRecordMock,
  getContractorByIdMock,
  createJobActivityRecordMock,
} = vi.hoisted(() => ({
  getJobByIdMock: vi.fn(),
  updateJobRecordMock: vi.fn(),
  getContractorByIdMock: vi.fn(),
  createJobActivityRecordMock: vi.fn(),
}));

vi.mock("@/repositories/jobs", async () => {
  const actual = await vi.importActual<typeof import("@/repositories/jobs")>(
    "@/repositories/jobs",
  );
  return {
    ...actual,
    getJobById: getJobByIdMock,
    updateJob: updateJobRecordMock,
    createJobActivity: createJobActivityRecordMock,
  };
});

vi.mock("@/repositories/contractors", async () => {
  const actual = await vi.importActual<
    typeof import("@/repositories/contractors")
  >("@/repositories/contractors");
  return {
    ...actual,
    getContractorById: getContractorByIdMock,
  };
});

import { assignContractor } from "@/services/jobs";

const job = { id: "job-1", contractorIds: [] as string[] };
const contractor = { id: "c-1", companyName: "Arctic Air" };

beforeEach(() => {
  vi.clearAllMocks();
  getJobByIdMock.mockResolvedValue(job);
  updateJobRecordMock.mockResolvedValue({ ...job, contractorIds: ["c-1"] });
});

describe("assignContractor", () => {
  it("rejects an unknown contractor id before writing anything", async () => {
    getContractorByIdMock.mockResolvedValue(null);

    await expect(assignContractor("job-1", "ghost-id")).rejects.toThrow(
      "Contractor not found.",
    );

    expect(updateJobRecordMock).not.toHaveBeenCalled();
    expect(createJobActivityRecordMock).not.toHaveBeenCalled();
  });

  it("assigns a known contractor and records the timeline event", async () => {
    getContractorByIdMock.mockResolvedValue(contractor);

    const result = await assignContractor("job-1", "c-1");

    expect(updateJobRecordMock).toHaveBeenCalledWith("job-1", {
      contractorIds: ["c-1"],
    });
    expect(createJobActivityRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        title: "Contractor assigned",
        description: "Arctic Air assigned to the job.",
      }),
    );
    expect(result).toEqual({ ...job, contractorIds: ["c-1"] });
  });

  it("still rejects duplicates and missing ids", async () => {
    getJobByIdMock.mockResolvedValue({ id: "job-1", contractorIds: ["c-1"] });

    await expect(assignContractor("job-1", "c-1")).rejects.toThrow(
      "already assigned",
    );
    await expect(assignContractor("job-1", "   ")).rejects.toThrow(
      "Contractor is required.",
    );
    expect(updateJobRecordMock).not.toHaveBeenCalled();
  });
});
