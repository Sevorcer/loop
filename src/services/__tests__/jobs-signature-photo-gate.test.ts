/**
 * Signature vs. photo gate — a customer signature is stored as a job file
 * (image/png in the "job-signatures" bucket, uploaded through the tech's
 * session), but it is not a job photo. It must not satisfy the Full
 * closeout photo gate, and it must not appear in — or inflate the counts
 * of — the Photos & Files list.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getJobByIdMock,
  updateJobMock,
  createJobActivityMock,
  listActivityByJobIdMock,
  updateDispatchPlanStatusByJobIdMock,
  listFilesMock,
  getInstalledSystemsSnapshotMock,
  listJobNotesMock,
  resolveCustomerIdByNameMock,
  resolvePropertyIdByNameMock,
  syncCustomerCountersMock,
  syncPropertyCountersMock,
} = vi.hoisted(() => ({
  getJobByIdMock: vi.fn(),
  updateJobMock: vi.fn(),
  createJobActivityMock: vi.fn(),
  listActivityByJobIdMock: vi.fn(),
  updateDispatchPlanStatusByJobIdMock: vi.fn(),
  listFilesMock: vi.fn(),
  getInstalledSystemsSnapshotMock: vi.fn(),
  listJobNotesMock: vi.fn(),
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
  listActivityByJobId: listActivityByJobIdMock,
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

vi.mock("@/repositories/dispatch", () => ({
  updateDispatchPlanStatusByJobId: updateDispatchPlanStatusByJobIdMock,
}));

vi.mock("@/services/customers", () => ({
  syncCustomerCounters: syncCustomerCountersMock,
}));

vi.mock("@/services/properties", () => ({
  resolvePropertyIdByName: resolvePropertyIdByNameMock,
  syncPropertyCounters: syncPropertyCountersMock,
}));

vi.mock("@/services/storage", () => ({
  listFiles: listFilesMock,
}));

vi.mock("@/services/installedSystems", () => ({
  getInstalledSystemsSnapshot: getInstalledSystemsSnapshotMock,
}));

vi.mock("@/repositories/jobNotes", () => ({
  listJobNotes: listJobNotesMock,
  insertJobNote: vi.fn(),
}));

import { getJobCompletionChecklist, listJobFiles, updateJobStatus } from "@/services/jobs";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-001",
    jobNumber: "JOB-1001",
    title: "Install",
    type: "Install",
    status: "In Progress",
    priority: "Medium",
    customerName: "Acme Corp",
    propertyName: "Acme HQ",
    assignedTo: "Tech A",
    scheduledFor: "2026-11-02",
    summary: "Summary",
    location: "123 Main St",
    notes: "Install finished.",
    closeoutMode: "full",
    ...overrides,
  };
}

// Exactly what captureJobSignature stores: a PNG in the signature bucket,
// uploaded by the tech who captured it on their device.
const SIGNATURE_FILE = {
  id: "file-signature",
  bucket: "job-signatures",
  fileName: "customer-signature.png",
  mimeType: "image/png",
  uploaderRole: "tech",
};

// A real field photo uploaded through the job files endpoint.
const TECH_PHOTO_FILE = {
  id: "file-photo",
  bucket: "job-files",
  fileName: "furnace-front.jpg",
  mimeType: "image/jpeg",
  uploaderRole: "tech",
};

// As of 2026-11-03 the photo gate is role-agnostic: a non-signature image from
// any signed-in org member counts, not only a technician.
const OFFICE_PHOTO_FILE = {
  id: "file-office-photo",
  bucket: "job-files",
  fileName: "install-complete.jpg",
  mimeType: "image/jpeg",
  uploaderRole: "office",
};

const COMPLETE_QA_ACTIVITY = [
  {
    id: "qa-1",
    jobId: "job-001",
    type: "qa",
    title: "QA checklist updated",
    description: JSON.stringify({
      startupVerificationComplete: true,
      safetyReviewComplete: true,
      workAreaCleaned: true,
    }),
    timestamp: new Date().toISOString(),
  },
];

function satisfySystemsAndQa() {
  getInstalledSystemsSnapshotMock.mockResolvedValue({
    installedSystems: [{ jobId: "job-001", linkedWorkflowIds: [] }],
    technicalProfiles: [],
  });
  listActivityByJobIdMock.mockResolvedValue(COMPLETE_QA_ACTIVITY);
}

beforeEach(() => {
  vi.clearAllMocks();
  listFilesMock.mockResolvedValue([]);
  getInstalledSystemsSnapshotMock.mockResolvedValue({
    installedSystems: [],
    technicalProfiles: [],
  });
  listActivityByJobIdMock.mockResolvedValue([]);
  listJobNotesMock.mockResolvedValue([]);
  resolveCustomerIdByNameMock.mockResolvedValue(null);
  resolvePropertyIdByNameMock.mockResolvedValue(null);
  syncCustomerCountersMock.mockResolvedValue(undefined);
  syncPropertyCountersMock.mockResolvedValue(undefined);
  createJobActivityMock.mockResolvedValue({ id: "act-1" });
  updateDispatchPlanStatusByJobIdMock.mockResolvedValue({ ok: true, data: [] });
});

// ─── The photo gate ──────────────────────────────────────────────────────────

describe("signature files and the closeout photo gate", () => {
  it("a signature alone does NOT satisfy the photo gate", async () => {
    getJobByIdMock.mockResolvedValue(makeJob());
    listFilesMock.mockResolvedValue([SIGNATURE_FILE]);
    satisfySystemsAndQa();

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.photosUploaded).toBe(false);
    expect(checklist.installedSystemsEntered).toBe(true);
    expect(checklist.jobNotesCompleted).toBe(true);
    expect(checklist.requiredQaItemsComplete).toBe(true);
    expect(checklist.canComplete).toBe(false);
  });

  it("completion is blocked naming the photo when only a signature exists", async () => {
    getJobByIdMock.mockResolvedValue(makeJob());
    listFilesMock.mockResolvedValue([SIGNATURE_FILE]);
    satisfySystemsAndQa();

    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow("Cannot complete job — missing at least one photo.");
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("a real tech-uploaded photo still satisfies the photo gate", async () => {
    getJobByIdMock.mockResolvedValue(makeJob());
    listFilesMock.mockResolvedValue([TECH_PHOTO_FILE]);
    satisfySystemsAndQa();

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.photosUploaded).toBe(true);
    expect(checklist.canComplete).toBe(true);
  });

  it("a non-signature image from a non-tech uploader (office) satisfies the photo gate", async () => {
    // Role-agnostic as of 2026-11-03: any signed-in org member's photo counts.
    getJobByIdMock.mockResolvedValue(makeJob());
    listFilesMock.mockResolvedValue([OFFICE_PHOTO_FILE]);
    satisfySystemsAndQa();

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.photosUploaded).toBe(true);
    expect(checklist.canComplete).toBe(true);
  });

  it("a signature plus a photo satisfies the gate via the photo", async () => {
    getJobByIdMock.mockResolvedValue(makeJob());
    listFilesMock.mockResolvedValue([SIGNATURE_FILE, TECH_PHOTO_FILE]);
    satisfySystemsAndQa();

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.photosUploaded).toBe(true);
    expect(checklist.canComplete).toBe(true);
  });
});

// ─── The Photos & Files list ─────────────────────────────────────────────────

describe("listJobFiles — signatures are not job files", () => {
  it("returns exactly one file for a signature plus a photo", async () => {
    listFilesMock.mockResolvedValue([SIGNATURE_FILE, TECH_PHOTO_FILE]);

    const files = await listJobFiles("job-001", "office");

    expect(files).toHaveLength(1);
    expect(files[0].id).toBe("file-photo");
  });

  it("returns no files when the job has only a signature", async () => {
    listFilesMock.mockResolvedValue([SIGNATURE_FILE]);

    const files = await listJobFiles("job-001", "office");

    expect(files).toEqual([]);
  });

  it("keeps ordinary uploads, including non-tech and non-image files", async () => {
    const officePdf = {
      id: "file-estimate",
      bucket: "job-files",
      fileName: "estimate.pdf",
      mimeType: "application/pdf",
      uploaderRole: "office",
    };
    listFilesMock.mockResolvedValue([SIGNATURE_FILE, TECH_PHOTO_FILE, officePdf]);

    const files = await listJobFiles("job-001", "office");

    expect(files.map((file) => file.id)).toEqual(["file-photo", "file-estimate"]);
  });
});
