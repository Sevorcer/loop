/**
 * T3 end-to-end: a multi-day job created through the New Job path persists its
 * scheduled end, which is the only thing that makes the #301 completion gate
 * reachable live.
 *
 * Before this fix the create path dropped the end date, so every created job
 * looked single-day and `updateJobStatus`'s multi-day day block (added in #301,
 * ahead of the checklist gate) could never fire for a job made in the UI. This
 * test walks the real flow: create a Nov 2 -> Nov 5 job, confirm the end is
 * handed to persistence and carried on the returned job, then drive that job
 * through `updateJobStatus` to prove the gate now blocks completion before the
 * final day (both closeout modes, naming the day) and allows it on the day.
 *
 * "Today" is pinned with a fake Date so the assertions do not depend on the
 * wall clock; the real company-timezone helpers stay in play.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getMaxJobNumberSuffixMock,
  createJobRecordMock,
  getJobByIdMock,
  updateJobMock,
  createJobActivityMock,
  listActivityByJobIdMock,
  resolveCustomerIdByNameMock,
  resolvePropertyIdByNameMock,
  syncCustomerCountersMock,
  syncPropertyCountersMock,
  listFilesMock,
  getInstalledSystemsSnapshotMock,
  listJobNotesMock,
  insertJobNoteMock,
  updateDispatchPlanStatusByJobIdMock,
  listDispatchPlansByJobIdMock,
  createDispatchPlanMock,
  updateDispatchPlanPlacementMock,
  deleteDispatchPlansForJobExceptMock,
  upsertScheduleBlockMock,
} = vi.hoisted(() => ({
  getMaxJobNumberSuffixMock: vi.fn(),
  createJobRecordMock: vi.fn(),
  getJobByIdMock: vi.fn(),
  updateJobMock: vi.fn(),
  createJobActivityMock: vi.fn(),
  listActivityByJobIdMock: vi.fn(),
  resolveCustomerIdByNameMock: vi.fn(),
  resolvePropertyIdByNameMock: vi.fn(),
  syncCustomerCountersMock: vi.fn(),
  syncPropertyCountersMock: vi.fn(),
  listFilesMock: vi.fn(),
  getInstalledSystemsSnapshotMock: vi.fn(),
  listJobNotesMock: vi.fn(),
  insertJobNoteMock: vi.fn(),
  updateDispatchPlanStatusByJobIdMock: vi.fn(),
  listDispatchPlansByJobIdMock: vi.fn(),
  createDispatchPlanMock: vi.fn(),
  updateDispatchPlanPlacementMock: vi.fn(),
  deleteDispatchPlansForJobExceptMock: vi.fn(),
  upsertScheduleBlockMock: vi.fn(),
}));

vi.mock("@/repositories/jobs", () => ({
  getMaxJobNumberSuffix: getMaxJobNumberSuffixMock,
  createJob: createJobRecordMock,
  getJobById: getJobByIdMock,
  getJobRowById: vi.fn(),
  updateJob: updateJobMock,
  createJobActivity: createJobActivityMock,
  listActivityByJobId: listActivityByJobIdMock,
  listJobs: vi.fn(),
  listJobActivity: vi.fn(),
  listJobsByCustomerId: vi.fn(),
  listJobsByPropertyId: vi.fn(),
  deleteJob: vi.fn(),
  countJobs: vi.fn(),
  countUnscheduledJobs: vi.fn(),
  listJobsForDispatch: vi.fn(),
  listJobsInRange: vi.fn(),
  listRecentJobs: vi.fn(),
  toJob: vi.fn(),
}));

vi.mock("@/repositories/properties", () => ({
  resolveCustomerIdByName: resolveCustomerIdByNameMock,
}));

vi.mock("@/services/properties", () => ({
  resolvePropertyIdByName: resolvePropertyIdByNameMock,
  syncPropertyCounters: syncPropertyCountersMock,
}));

vi.mock("@/services/customers", () => ({
  syncCustomerCounters: syncCustomerCountersMock,
}));

vi.mock("@/services/storage", () => ({
  listFiles: listFilesMock,
}));

vi.mock("@/services/installedSystems", () => ({
  getInstalledSystemsSnapshot: getInstalledSystemsSnapshotMock,
}));

vi.mock("@/repositories/jobNotes", () => ({
  listJobNotes: listJobNotesMock,
  insertJobNote: insertJobNoteMock,
}));

vi.mock("@/repositories/dispatch", () => ({
  updateDispatchPlanStatusByJobId: updateDispatchPlanStatusByJobIdMock,
  listDispatchPlansByJobId: listDispatchPlansByJobIdMock,
  createDispatchPlan: createDispatchPlanMock,
  updateDispatchPlanPlacement: updateDispatchPlanPlacementMock,
  deleteDispatchPlansForJobExcept: deleteDispatchPlansForJobExceptMock,
  deleteDispatchPlansByJobId: vi.fn(),
  updateDispatchPlanStatusByJobIdExcept: vi.fn(),
  upsertScheduleBlock: upsertScheduleBlockMock,
}));

import { createJob, updateJobStatus } from "@/services/jobs";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const START_AT = "2026-11-02T17:05:00.000Z"; // Nov 2, 9:05 AM PST
const END_AT = "2026-11-05T17:00:00.000Z"; // Nov 5 — makes the job span 4 days

function makeCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Rooftop changeout",
    type: "Install" as const,
    priority: "Medium" as const,
    customerId: "cust-1",
    customerName: "Acme Corp",
    propertyId: "prop-1",
    propertyName: "Acme HQ",
    assignedTo: "",
    assigneeIds: [],
    location: "123 Main St",
    summary: "Multi-day rooftop install",
    notes: "",
    scheduledFor: "2026-11-02",
    scheduledStartAt: START_AT,
    scheduledEndAt: END_AT,
    arrivalWindowStartAt: null,
    arrivalWindowEndAt: null,
    closeoutMode: "full" as const,
    ...overrides,
  };
}

/**
 * The repository mock echoes the scheduling fields it was handed, mirroring a
 * real insert: whatever the create path forwards is what the stored row — and
 * every later reader — will carry.
 */
function createdJobFrom(input: Record<string, unknown>) {
  return {
    id: "job-001",
    jobNumber: "JOB-1001",
    title: input.title,
    type: input.type,
    status: "Scheduled",
    priority: input.priority,
    customerId: input.customerId ?? null,
    customerName: input.customerName,
    propertyId: input.propertyId ?? null,
    propertyName: input.propertyName,
    assignedTo: input.assignedTo ?? "",
    assignees: [],
    scheduledFor: input.scheduledFor ?? null,
    scheduledStartAt: input.scheduledStartAt ?? null,
    scheduledEndAt: input.scheduledEndAt ?? null,
    arrivalWindowStartAt: input.arrivalWindowStartAt ?? null,
    arrivalWindowEndAt: input.arrivalWindowEndAt ?? null,
    appointmentHour: input.appointmentHour ?? 9,
    closeoutMode: input.closeoutMode ?? "full",
    summary: input.summary ?? "",
    location: input.location ?? "",
    notes: input.notes ?? "",
    contractorIds: [],
  };
}

// Full-mode closeout gates satisfied, so only the multi-day day block can stop
// a completion (the day block runs ahead of the checklist gate either way).
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
  // Pin "today" to Nov 2, 2026 (09:00 PST = 17:00Z, after DST ends Nov 1).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T17:00:00.000Z"));

  getMaxJobNumberSuffixMock.mockResolvedValue(1000);
  createJobRecordMock.mockImplementation(async (_jobNumber: string, input: Record<string, unknown>) =>
    createdJobFrom(input),
  );
  createJobActivityMock.mockResolvedValue({ id: "act-1" });
  syncCustomerCountersMock.mockResolvedValue(undefined);
  syncPropertyCountersMock.mockResolvedValue(undefined);
  resolveCustomerIdByNameMock.mockResolvedValue(null);
  resolvePropertyIdByNameMock.mockResolvedValue(null);
  insertJobNoteMock.mockResolvedValue({ id: "note-1" });
  listJobNotesMock.mockResolvedValue([]);
  updateDispatchPlanStatusByJobIdMock.mockResolvedValue({ ok: true, data: [] });
  listDispatchPlansByJobIdMock.mockResolvedValue({ ok: true, data: [] });
  createDispatchPlanMock.mockResolvedValue({ ok: true, data: { id: "plan-1" } });
  updateDispatchPlanPlacementMock.mockResolvedValue({ ok: true, data: { id: "plan-1" } });
  deleteDispatchPlansForJobExceptMock.mockResolvedValue({ ok: true, data: [] });
  upsertScheduleBlockMock.mockResolvedValue({ ok: true, data: { id: "block-1" } });
  satisfyFullGates();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("New Job create -> multi-day completion gate (T3 end-to-end)", () => {
  it("forwards the scheduled end to persistence and carries it on the created job", async () => {
    const input = makeCreateInput();
    const job = await createJob(input);

    // The create path handed the end to the repository insert — the previous
    // bug dropped it before this point, leaving scheduled_end_at null.
    expect(createJobRecordMock).toHaveBeenCalledTimes(1);
    const [, persisted] = createJobRecordMock.mock.calls[0];
    expect(persisted.scheduledStartAt).toBe(START_AT);
    expect(persisted.scheduledEndAt).toBe(END_AT);

    // ...and the span survives on the returned job the rest of the app reads.
    expect(job.scheduledStartAt).toBe(START_AT);
    expect(job.scheduledEndAt).toBe(END_AT);
  });

  it("then blocks full-mode completion before the final day, naming that day", async () => {
    const job = await createJob(makeCreateInput({ closeoutMode: "full" }));
    expect(job.scheduledEndAt).toBe(END_AT);

    // The job is started, then an early completion is attempted on Nov 2.
    getJobByIdMock.mockResolvedValue({ ...job, status: "In Progress" });

    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow("Nov 5, 2026");
    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow(/cannot be completed before its final scheduled day/);
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("then blocks visit-mode completion the same way, before its final day", async () => {
    const job = await createJob(
      makeCreateInput({ closeoutMode: "visit", notes: "Day one done." }),
    );
    expect(job.scheduledEndAt).toBe(END_AT);

    // Visit closeout completes on a note alone, yet the day block still fires
    // because it runs ahead of the checklist gate.
    getJobByIdMock.mockResolvedValue({
      ...job,
      status: "In Progress",
      closeoutMode: "visit",
      notes: "Day one done.",
    });

    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow("Nov 5, 2026");
    await expect(
      updateJobStatus("job-001", "Completed", { role: "office" }),
    ).rejects.toThrow(/cannot be completed before its final scheduled day/);
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("allows completion once today is the final scheduled day", async () => {
    const job = await createJob(
      makeCreateInput({ closeoutMode: "full", notes: "Install finished." }),
    );
    const started = { ...job, status: "In Progress" };
    getJobByIdMock.mockResolvedValue(started);
    const completed = { ...started, status: "Completed" };
    updateJobMock.mockResolvedValue(completed);

    // Advance to Nov 5 — the final scheduled day.
    vi.setSystemTime(new Date("2026-11-05T18:00:00.000Z"));

    const result = await updateJobStatus("job-001", "Completed", { role: "office" });

    expect(result).toEqual(completed);
    expect(updateJobMock).toHaveBeenCalledWith("job-001", { status: "Completed" });
  });
});
