/**
 * R2: any signed-in role can edit any note; activity log gets an edit trace.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getJobByIdMock,
  updateJobNoteMock,
  createJobActivityMock,
} = vi.hoisted(() => ({
  getJobByIdMock: vi.fn(),
  updateJobNoteMock: vi.fn(),
  createJobActivityMock: vi.fn(),
}));

vi.mock("@/repositories/jobs", () => ({
  getJobById: getJobByIdMock,
  createJobActivity: createJobActivityMock,
  updateJob: vi.fn(),
  createJob: vi.fn(),
  deleteJob: vi.fn(),
  listJobs: vi.fn(),
  listActivityByJobId: vi.fn(),
  listJobActivity: vi.fn(),
  listJobsByCustomerId: vi.fn(),
  listJobsByPropertyId: vi.fn(),
  countJobs: vi.fn(),
  toJob: vi.fn(),
  getJobRowById: vi.fn(),
}));

vi.mock("@/repositories/jobNotes", () => ({
  insertJobNote: vi.fn(),
  listJobNotes: vi.fn(),
  updateJobNote: updateJobNoteMock,
}));

vi.mock("@/repositories/properties", () => ({
  resolveCustomerIdByName: vi.fn(),
}));

vi.mock("@/services/storage", () => ({ listFiles: vi.fn() }));
vi.mock("@/services/installedSystems", () => ({
  getInstalledSystemsSnapshot: vi.fn(),
}));
vi.mock("@/repositories/billing", () => ({ setBillingEligible: vi.fn() }));
vi.mock("@/repositories/dispatch", () => ({
  updateDispatchPlanStatusByJobId: vi.fn(),
}));
vi.mock("@/services/customers", () => ({ syncCustomerCounters: vi.fn() }));
vi.mock("@/services/properties", () => ({
  resolvePropertyIdByName: vi.fn(),
  syncPropertyCounters: vi.fn(),
}));

import { updateJobNoteBody } from "@/services/jobs";

describe("updateJobNoteBody (R2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getJobByIdMock.mockResolvedValue({ id: "job-1", notes: "" });
    updateJobNoteMock.mockResolvedValue({
      id: "note-1",
      jobId: "job-1",
      body: "Updated body",
      authorId: "u1",
      authorName: "Alex",
      authorRole: "tech",
      createdAt: "2026-11-05T00:00:00Z",
    });
    createJobActivityMock.mockResolvedValue({});
  });

  it("updates the note and writes an edit activity row", async () => {
    const result = await updateJobNoteBody("job-1", "note-1", "Updated body", {
      actorId: "u2",
      role: "office",
    });
    expect(result?.body).toBe("Updated body");
    expect(updateJobNoteMock).toHaveBeenCalledWith("note-1", "Updated body");
    expect(createJobActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        type: "note",
        title: "Note edited",
      }),
    );
  });

  it("rejects an empty body", async () => {
    await expect(updateJobNoteBody("job-1", "note-1", "   ")).rejects.toThrow(/required/i);
  });
});
