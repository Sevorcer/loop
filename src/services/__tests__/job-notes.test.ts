import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getJobByIdMock,
  createJobActivityMock,
  updateJobMock,
  listJobNotesMock,
  insertJobNoteMock,
  getCurrentOperatorMock,
} = vi.hoisted(() => ({
  getJobByIdMock: vi.fn(),
  createJobActivityMock: vi.fn(),
  updateJobMock: vi.fn(),
  listJobNotesMock: vi.fn(),
  insertJobNoteMock: vi.fn(),
  getCurrentOperatorMock: vi.fn(),
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
  listJobsForDispatch: vi.fn(),
  createJob: vi.fn(),
  deleteJob: vi.fn(),
  countJobs: vi.fn(),
  getMaxJobNumberSuffix: vi.fn(),
  toJob: vi.fn(),
}));

vi.mock("@/repositories/jobNotes", () => ({
  listJobNotes: listJobNotesMock,
  insertJobNote: insertJobNoteMock,
}));

vi.mock("@/repositories/dispatch", () => ({
  createDispatchPlan: vi.fn(),
  deleteDispatchPlansByJobId: vi.fn(),
  deleteDispatchPlansForJobExcept: vi.fn(),
  updateDispatchPlanStatusByJobId: vi.fn(),
  listDispatchPlansByJobId: vi.fn(),
  updateDispatchPlanPlacement: vi.fn(),
  upsertScheduleBlock: vi.fn(),
}));

vi.mock("@/repositories/properties", () => ({
  resolveCustomerIdByName: vi.fn(),
}));

vi.mock("@/repositories/contractors", () => ({
  getContractorById: vi.fn(),
}));

vi.mock("@/services/customers", () => ({
  syncCustomerCounters: vi.fn(),
}));

vi.mock("@/services/properties", () => ({
  resolvePropertyIdByName: vi.fn(),
  syncPropertyCounters: vi.fn(),
}));

vi.mock("@/services/storage", () => ({
  listFiles: vi.fn(),
}));

vi.mock("@/services/installedSystems", () => ({
  getInstalledSystemsSnapshot: vi.fn(),
}));

vi.mock("@/services/currentOperator", () => ({
  getCurrentOperator: getCurrentOperatorMock,
}));

import { JOB_NOTE_ACTIVITY_TITLE } from "@/features/jobs/utils/jobNotes";
import { setJobNotes } from "@/services/jobs";

const officeNote = "Office: customer wants the condenser on the north wall.";

describe("setJobNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentOperatorMock.mockResolvedValue({ name: "Alex Tech", appRole: "tech" });
    createJobActivityMock.mockResolvedValue({ id: "activity-1" });
    insertJobNoteMock.mockImplementation(async (input: { body: string }) => ({
      id: `note-${input.body.length}`,
      body: input.body,
    }));
    updateJobMock.mockResolvedValue(null);
  });

  it("appends a tech note without replacing the office note", async () => {
    getJobByIdMock.mockResolvedValue({ id: "job-1", notes: officeNote });
    listJobNotesMock.mockResolvedValue([]);

    const result = await setJobNotes("job-1", "Set the condenser pad.", {
      actorId: "tech-1",
      role: "tech",
    });

    expect(result).toEqual({ id: "job-1", notes: officeNote });
    expect(updateJobMock).not.toHaveBeenCalled();
    expect(insertJobNoteMock).toHaveBeenCalledTimes(1);
    expect(insertJobNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        body: "Set the condenser pad.",
        authorId: "tech-1",
        authorName: "Alex Tech",
        authorRole: "tech",
      }),
    );
    expect(createJobActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "note",
        title: JOB_NOTE_ACTIVITY_TITLE,
        description: expect.stringContaining("Alex Tech · Technician\nSet the condenser pad."),
      }),
    );
    expect(createJobActivityMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "QA checklist updated" }),
    );
  });

  it("copies the existing column into history when an owner adds the first note", async () => {
    getJobByIdMock.mockResolvedValue({ id: "job-1", notes: officeNote });
    listJobNotesMock.mockResolvedValue([]);

    await setJobNotes("job-1", "Office follow-up.", { actorId: "owner-1", role: "owner" });

    expect(insertJobNoteMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ body: officeNote, authorName: "Earlier note" }),
    );
    expect(insertJobNoteMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ body: "Office follow-up.", authorRole: "owner" }),
    );
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("does not copy the column again once history exists", async () => {
    getJobByIdMock.mockResolvedValue({ id: "job-1", notes: officeNote });
    listJobNotesMock.mockResolvedValue([{ id: "existing", body: officeNote }]);

    await setJobNotes("job-1", "Filter replaced.", { actorId: "office-1", role: "office" });

    expect(insertJobNoteMock).toHaveBeenCalledTimes(1);
    expect(insertJobNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Filter replaced.",
        authorRole: "office",
        authorName: "Alex Tech",
      }),
    );
  });
});
