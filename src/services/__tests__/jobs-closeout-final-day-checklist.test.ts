/**
 * Completion-checklist payload — final-day block (B1).
 *
 * The guided closeout panel reads this payload, so it must carry the same
 * multi-day block the completion path enforces: while today (company
 * timezone) is before the job's final scheduled day, finalDayBlocker holds
 * the refusal's sentence and canComplete is false, in both closeout modes.
 * Mirrors jobs-multiday-completion.test.ts (fake Date, real tz helpers).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/repositories/billing", () => ({
  setBillingEligible: vi.fn(),
}));

import {
  finalScheduledDayBlocker,
  getJobCompletionChecklist,
} from "@/services/jobs";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-001",
    jobNumber: "JOB-1001",
    title: "Rooftop changeout",
    type: "Install",
    status: "In Progress",
    priority: "Medium",
    customerName: "Acme Corp",
    propertyName: "Acme HQ",
    assignedTo: "Tech A",
    scheduledFor: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    summary: "Summary",
    location: "123 Main St",
    notes: "Install finished.",
    closeoutMode: "full",
    ...overrides,
  };
}

// Make the full-mode checklist gates all pass, so the only thing that can
// block a full-mode completion is the multi-day day gate under test.
function satisfyFullGates() {
  listFilesMock.mockResolvedValue([
    { id: "file-1", mimeType: "image/jpeg", uploaderRole: "tech" },
  ]);
  getInstalledSystemsSnapshotMock.mockResolvedValue({
    installedSystems: [{ jobId: "job-001", linkedWorkflowIds: [] }],
    technicalProfiles: [],
  });
  listActivityByJobIdMock.mockResolvedValue([
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
      timestamp: "2026-11-02T00:00:00.000Z",
    },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Pin "today" to Nov 2, 2026 (10:00 PST = 18:00Z, after DST ends Nov 1).
  // Fake only Date so async service plumbing keeps its real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T18:00:00.000Z"));
  // Defaults: full-mode gates all satisfied, so date gating is isolated.
  satisfyFullGates();
  listJobNotesMock.mockResolvedValue([]);
  resolveCustomerIdByNameMock.mockResolvedValue(null);
  resolvePropertyIdByNameMock.mockResolvedValue(null);
  syncCustomerCountersMock.mockResolvedValue(undefined);
  syncPropertyCountersMock.mockResolvedValue(undefined);
  createJobActivityMock.mockResolvedValue({ id: "act-1" });
  updateDispatchPlanStatusByJobIdMock.mockResolvedValue({ ok: true, data: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

const NOV3_TO_NOV4 = {
  scheduledStartAt: "2026-11-03T16:00:00.000Z",
  scheduledEndAt: "2026-11-04T16:00:00.000Z",
};

describe("getJobCompletionChecklist — final-day block", () => {
  it("blocks a multi-day job before its final day, naming the end date", async () => {
    // Rehearsal repro: Nov 3–4 job, every gate done on Nov 3.
    vi.setSystemTime(new Date("2026-11-03T20:00:00.000Z"));
    getJobByIdMock.mockResolvedValue(makeJob({ closeoutMode: "full", ...NOV3_TO_NOV4 }));

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.photosUploaded).toBe(true);
    expect(checklist.requiredQaItemsComplete).toBe(true);
    expect(checklist.finalDayBlocker).toBe(
      "this job runs through Nov 4, 2026 and cannot be completed before its final scheduled day",
    );
    expect(checklist.canComplete).toBe(false);
  });

  it("clears the block on the final day", async () => {
    vi.setSystemTime(new Date("2026-11-04T20:00:00.000Z"));
    getJobByIdMock.mockResolvedValue(makeJob({ closeoutMode: "full", ...NOV3_TO_NOV4 }));

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.finalDayBlocker).toBeNull();
    expect(checklist.canComplete).toBe(true);
  });

  it("uses the company day, not UTC, for today", async () => {
    // 2026-11-04T05:00Z is still Nov 3 at 21:00 in Los Angeles.
    vi.setSystemTime(new Date("2026-11-04T05:00:00.000Z"));
    getJobByIdMock.mockResolvedValue(makeJob({ closeoutMode: "full", ...NOV3_TO_NOV4 }));

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.finalDayBlocker).toContain("Nov 4, 2026");
    expect(checklist.canComplete).toBe(false);
  });

  it("leaves a single-day job unaffected", async () => {
    vi.setSystemTime(new Date("2026-11-03T20:00:00.000Z"));
    getJobByIdMock.mockResolvedValue(
      makeJob({
        closeoutMode: "full",
        scheduledStartAt: "2026-11-10T16:00:00.000Z",
        scheduledEndAt: null,
      }),
    );

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.finalDayBlocker).toBeNull();
    expect(checklist.canComplete).toBe(true);
  });

  it("blocks a visit-mode multi-day job before its final day too", async () => {
    vi.setSystemTime(new Date("2026-11-03T20:00:00.000Z"));
    getJobByIdMock.mockResolvedValue(
      makeJob({ closeoutMode: "visit", notes: "Day one done.", ...NOV3_TO_NOV4 }),
    );

    const checklist = await getJobCompletionChecklist("job-001", "office");

    expect(checklist.closeoutMode).toBe("visit");
    expect(checklist.jobNotesCompleted).toBe(true);
    expect(checklist.finalDayBlocker).toContain("Nov 4, 2026");
    expect(checklist.canComplete).toBe(false);
  });
});

describe("finalScheduledDayBlocker", () => {
  it("treats an end on the start day as single-day", () => {
    expect(
      finalScheduledDayBlocker(
        {
          scheduledStartAt: "2026-11-03T16:00:00.000Z",
          scheduledEndAt: "2026-11-03T23:00:00.000Z",
        },
        "2026-11-01",
      ),
    ).toBeNull();
  });
});
