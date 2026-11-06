/**
 * Closeout mode — per-job "full" vs "visit" completion gates.
 *
 * Full (default): completion requires a tech photo, an installed system
 * linked to the job, a job note, and the required QA items.
 * Visit: completion requires a job note only — single-visit jobs such as
 * inspection finals must not be forced through the install gates.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/services/inventoryReservations", () => ({ releaseAndRecheck: vi.fn(async () => undefined) }));

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

vi.mock("@/repositories/billing", () => ({
  setBillingEligible: vi.fn(),
}));

import { getJobCompletionChecklist, updateJobStatus } from "@/services/jobs";
import { completionBlockers } from "@/features/jobs/utils/jobCompletionChecklist";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-001",
    jobNumber: "JOB-1001",
    title: "Inspection final",
    type: "Inspection",
    status: "In Progress",
    priority: "Medium",
    customerName: "Acme Corp",
    propertyName: "Acme HQ",
    assignedTo: "Tech A",
    scheduledFor: "2026-11-02",
    summary: "Summary",
    location: "123 Main St",
    notes: "",
    closeoutMode: "full",
    ...overrides,
  };
}

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

function satisfyPhoto() {
  listFilesMock.mockResolvedValue([
    { id: "file-1", mimeType: "image/jpeg", uploaderRole: "tech" },
  ]);
}

function satisfySystems() {
  getInstalledSystemsSnapshotMock.mockResolvedValue({
    installedSystems: [{ jobId: "job-001", linkedWorkflowIds: [] }],
    technicalProfiles: [],
  });
}

function satisfyQa() {
  listActivityByJobIdMock.mockResolvedValue(COMPLETE_QA_ACTIVITY);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: every full-mode gate unsatisfied.
  listFilesMock.mockResolvedValue([]);
  getInstalledSystemsSnapshotMock.mockResolvedValue({
    installedSystems: [],
    technicalProfiles: [],
  });
  listActivityByJobIdMock.mockResolvedValue([]);
  listJobNotesMock.mockResolvedValue([]);
  // Side-effect plumbing for successful transitions.
  resolveCustomerIdByNameMock.mockResolvedValue(null);
  resolvePropertyIdByNameMock.mockResolvedValue(null);
  syncCustomerCountersMock.mockResolvedValue(undefined);
  syncPropertyCountersMock.mockResolvedValue(undefined);
  createJobActivityMock.mockResolvedValue({ id: "act-1" });
  updateDispatchPlanStatusByJobIdMock.mockResolvedValue({ ok: true, data: [] });
});

// ─── getJobCompletionChecklist — visit mode ──────────────────────────────────

describe("getJobCompletionChecklist — visit closeout", () => {
  it("can complete with only a job note — no photo, system, or QA", async () => {
    getJobByIdMock.mockResolvedValue(
      makeJob({ closeoutMode: "visit", notes: "Met the inspector; final passed." }),
    );

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.closeoutMode).toBe("visit");
    expect(checklist.jobNotesCompleted).toBe(true);
    expect(checklist.photosUploaded).toBe(false);
    expect(checklist.installedSystemsEntered).toBe(false);
    expect(checklist.requiredQaItemsComplete).toBe(false);
    expect(checklist.canComplete).toBe(true);
  });

  it("counts a note from the note history, not just the notes field", async () => {
    getJobByIdMock.mockResolvedValue(makeJob({ closeoutMode: "visit", notes: "" }));
    listJobNotesMock.mockResolvedValue([
      { id: "note-1", jobId: "job-001", body: "Inspector signed off." },
    ]);

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.jobNotesCompleted).toBe(true);
    expect(checklist.canComplete).toBe(true);
  });

  it("cannot complete without a note", async () => {
    getJobByIdMock.mockResolvedValue(makeJob({ closeoutMode: "visit", notes: "" }));

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.closeoutMode).toBe("visit");
    expect(checklist.jobNotesCompleted).toBe(false);
    expect(checklist.canComplete).toBe(false);
  });

  // B9 — pin: the note gate is satisfied by ANY note, not only a tech-authored
  // one. An office-authored note must keep closing out a visit job, so this
  // behavior cannot silently regress to a tech-only check.
  it("accepts an office-authored note (any author satisfies the gate)", async () => {
    getJobByIdMock.mockResolvedValue(makeJob({ closeoutMode: "visit", notes: "" }));
    listJobNotesMock.mockResolvedValue([
      {
        id: "note-office",
        jobId: "job-001",
        body: "Office confirmed inspection scheduled.",
        authorId: "office-1",
        authorName: "Dana Office",
        authorRole: "office",
      },
    ]);

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.jobNotesCompleted).toBe(true);
    expect(checklist.canComplete).toBe(true);
  });
});

// ─── getJobCompletionChecklist — full mode and the default ───────────────────

describe("getJobCompletionChecklist — full closeout", () => {
  it("can complete when all four gates are satisfied", async () => {
    getJobByIdMock.mockResolvedValue(
      makeJob({ closeoutMode: "full", notes: "Install finished." }),
    );
    satisfyPhoto();
    satisfySystems();
    satisfyQa();

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.closeoutMode).toBe("full");
    expect(checklist.canComplete).toBe(true);
  });

  it("defaults to full when the job carries no closeout mode", async () => {
    const job = makeJob({ notes: "Install finished." });
    delete (job as Record<string, unknown>).closeoutMode;
    getJobByIdMock.mockResolvedValue(job);

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.closeoutMode).toBe("full");
    // Note is present but photo/system/QA are not — full gates still block.
    expect(checklist.canComplete).toBe(false);
  });
});

// ─── updateJobStatus — completion gating by mode ─────────────────────────────

describe("updateJobStatus — completion gating by closeout mode", () => {
  it("visit job completes with only a note", async () => {
    const original = makeJob({
      closeoutMode: "visit",
      notes: "Met the inspector; final passed.",
    });
    const updated = makeJob({
      closeoutMode: "visit",
      status: "Completed",
      notes: "Met the inspector; final passed.",
    });
    getJobByIdMock.mockResolvedValue(original);
    updateJobMock.mockResolvedValue(updated);

    const result = await updateJobStatus("job-001", "Completed", { role: "office" });

    expect(result).toEqual(updated);
    expect(updateJobMock).toHaveBeenCalledWith("job-001", { status: "Completed" });
  });

  it("visit job without a note is blocked, naming only the note", async () => {
    getJobByIdMock.mockResolvedValue(makeJob({ closeoutMode: "visit", notes: "" }));

    const attempt = updateJobStatus("job-001", "Completed", { role: "office" });
    await expect(attempt).rejects.toThrow("Cannot complete job — missing job notes.");
    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow(/^(?!.*(photo|installed systems|QA)).*$/s);
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("the visit-mode error feeds the job page a truthful still-needed list", () => {
    expect(completionBlockers("Cannot complete job — missing job notes.")).toEqual([
      "Job notes",
    ]);
  });

  it("full job is blocked by a missing photo alone", async () => {
    getJobByIdMock.mockResolvedValue(
      makeJob({ closeoutMode: "full", notes: "Install finished." }),
    );
    satisfySystems();
    satisfyQa();

    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow("Cannot complete job — missing at least one photo.");
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("full job is blocked by missing installed systems alone", async () => {
    getJobByIdMock.mockResolvedValue(
      makeJob({ closeoutMode: "full", notes: "Install finished." }),
    );
    satisfyPhoto();
    satisfyQa();

    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow("Cannot complete job — missing installed systems.");
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("full job is blocked by incomplete required QA alone", async () => {
    getJobByIdMock.mockResolvedValue(
      makeJob({ closeoutMode: "full", notes: "Install finished." }),
    );
    satisfyPhoto();
    satisfySystems();

    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow("Cannot complete job — incomplete required QA items.");
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("full job is blocked by a missing note alone", async () => {
    getJobByIdMock.mockResolvedValue(makeJob({ closeoutMode: "full", notes: "" }));
    satisfyPhoto();
    satisfySystems();
    satisfyQa();

    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow("Cannot complete job — missing job notes.");
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("full job completes when every gate is satisfied", async () => {
    const original = makeJob({ closeoutMode: "full", notes: "Install finished." });
    const updated = makeJob({
      closeoutMode: "full",
      status: "Completed",
      notes: "Install finished.",
    });
    getJobByIdMock.mockResolvedValue(original);
    updateJobMock.mockResolvedValue(updated);
    satisfyPhoto();
    satisfySystems();
    satisfyQa();

    const result = await updateJobStatus("job-001", "Completed", { role: "office" });

    expect(result).toEqual(updated);
    expect(updateJobMock).toHaveBeenCalledWith("job-001", { status: "Completed" });
  });
});
