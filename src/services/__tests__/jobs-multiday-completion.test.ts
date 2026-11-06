/**
 * Multi-day completion block — a job that spans several scheduled days must
 * not be completable before its final scheduled day.
 *
 * The final day is the scheduled end (scheduledEndAt), falling back to the
 * start day when there is no end. Day boundaries are counted in the company
 * timezone (America/Los_Angeles), the same windowing the dispatch board uses.
 * Single-day jobs (no end, or an end on the start day) are never gated, and
 * the block applies equally to full and visit closeout because it runs before
 * the checklist gate.
 *
 * "Today" is pinned with a fake Date so the assertions do not depend on the
 * wall clock when the suite runs externally; the real timezone helpers stay
 * in play so company-day arithmetic is exercised, not stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/services/inventoryReservations", () => ({ releaseAndRecheck: vi.fn(async () => undefined) }));
vi.mock("@/services/closeoutReconciliation", () => ({
  getMaterialsGate: vi.fn(async () => ({ required: false, reconciled: false, enforcement: "warn" })),
}));

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

import { updateJobStatus } from "@/services/jobs";

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

describe("updateJobStatus — multi-day completion block", () => {
  it("blocks completion on a day before the final scheduled day, naming that day", async () => {
    // Runs Nov 2 → Nov 5; today is Nov 2, two days early.
    getJobByIdMock.mockResolvedValue(
      makeJob({
        closeoutMode: "full",
        scheduledStartAt: "2026-11-02T18:00:00.000Z",
        scheduledEndAt: "2026-11-05T18:00:00.000Z",
      }),
    );

    const attempt = updateJobStatus("job-001", "Completed", { role: "office" });
    await expect(attempt).rejects.toThrow("Nov 5, 2026");
    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow(/cannot be completed before its final scheduled day/);
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("allows completion once today is the final scheduled day", async () => {
    // Same Nov 2 → Nov 5 job, but today is Nov 5.
    vi.setSystemTime(new Date("2026-11-05T18:00:00.000Z"));
    const updated = makeJob({ status: "Completed" });
    getJobByIdMock.mockResolvedValue(
      makeJob({
        closeoutMode: "full",
        scheduledStartAt: "2026-11-02T18:00:00.000Z",
        scheduledEndAt: "2026-11-05T18:00:00.000Z",
      }),
    );
    updateJobMock.mockResolvedValue(updated);

    const result = await updateJobStatus("job-001", "Completed", { role: "office" });

    expect(result).toEqual(updated);
    expect(updateJobMock).toHaveBeenCalledWith("job-001", { status: "Completed" });
  });

  it("blocks a visit-mode multi-day job the same way, before its final day", async () => {
    // Visit closeout satisfies its gate with a note, yet the day block still
    // fires because it runs ahead of the checklist gate.
    getJobByIdMock.mockResolvedValue(
      makeJob({
        closeoutMode: "visit",
        notes: "Day one done.",
        scheduledStartAt: "2026-11-02T18:00:00.000Z",
        scheduledEndAt: "2026-11-05T18:00:00.000Z",
      }),
    );

    const attempt = updateJobStatus("job-001", "Completed", { role: "office" });
    await expect(attempt).rejects.toThrow("Nov 5, 2026");
    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow(/cannot be completed before its final scheduled day/);
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("leaves a single-day job unaffected, completing even when scheduled ahead", async () => {
    // Single day (start only, no end) scheduled Nov 10 while today is Nov 2.
    // No multi-day span, so the day block never applies.
    const updated = makeJob({ status: "Completed" });
    getJobByIdMock.mockResolvedValue(
      makeJob({
        closeoutMode: "full",
        scheduledStartAt: "2026-11-10T18:00:00.000Z",
        scheduledEndAt: null,
      }),
    );
    updateJobMock.mockResolvedValue(updated);

    const result = await updateJobStatus("job-001", "Completed", { role: "office" });

    expect(result).toEqual(updated);
    expect(updateJobMock).toHaveBeenCalledWith("job-001", { status: "Completed" });
  });
});
