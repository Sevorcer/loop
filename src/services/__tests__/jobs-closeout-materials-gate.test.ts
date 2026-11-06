/**
 * Closeout reconciliation gate (Inventory Lane 4, PR E).
 *
 * `warn` (the launch stage) never blocks completion. `soft` and `hard` block a job that needs
 * reconciling until it is reconciled; an office override (a reconciliation row) clears soft.
 * Visit closeouts and jobs without a confirmed plan are exempt (the gate reports not required).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/services/inventoryReservations", () => ({ releaseAndRecheck: vi.fn(async () => undefined) }));

const {
  getMaterialsGateMock,
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
  getMaterialsGateMock: vi.fn(),
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

vi.mock("@/services/closeoutReconciliation", () => ({ getMaterialsGate: getMaterialsGateMock }));

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
    notes: "Done.",
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

function satisfyEveryOtherGate() {
  getJobByIdMock.mockResolvedValue(makeJob());
  listFilesMock.mockResolvedValue([{ id: "file-1", mimeType: "image/jpeg", uploaderRole: "tech" }]);
  getInstalledSystemsSnapshotMock.mockResolvedValue({
    installedSystems: [{ jobId: "job-001", linkedWorkflowIds: [] }],
    technicalProfiles: [],
  });
  listActivityByJobIdMock.mockResolvedValue(COMPLETE_QA_ACTIVITY);
}

beforeEach(() => {
  vi.clearAllMocks();
  listJobNotesMock.mockResolvedValue([]);
  resolveCustomerIdByNameMock.mockResolvedValue(null);
  resolvePropertyIdByNameMock.mockResolvedValue(null);
  syncCustomerCountersMock.mockResolvedValue(undefined);
  syncPropertyCountersMock.mockResolvedValue(undefined);
  createJobActivityMock.mockResolvedValue({ id: "act-1" });
  updateDispatchPlanStatusByJobIdMock.mockResolvedValue({ ok: true, data: [] });
  updateJobMock.mockResolvedValue(makeJob({ status: "Completed" }));
  satisfyEveryOtherGate();
});

const gate = (over: Record<string, unknown> = {}) =>
  getMaterialsGateMock.mockResolvedValue({ required: true, reconciled: false, enforcement: "warn", ...over });

describe("checklist — materials gate", () => {
  it("warn: the step is open but completion is not blocked", async () => {
    gate({ enforcement: "warn" });
    const checklist = await getJobCompletionChecklist("job-001", "tech");
    expect(checklist.materialsRequired).toBe(true);
    expect(checklist.materialsReconciled).toBe(false);
    expect(checklist.materialsBlocked).toBe(false);
    expect(checklist.canComplete).toBe(true);
  });

  it("soft: blocks until reconciled; only an office role is offered the override", async () => {
    gate({ enforcement: "soft" });
    const tech = await getJobCompletionChecklist("job-001", "tech");
    expect(tech.materialsBlocked).toBe(true);
    expect(tech.materialsCanOverride).toBe(false);
    expect(tech.canComplete).toBe(false);

    const office = await getJobCompletionChecklist("job-001", "office");
    expect(office.canComplete).toBe(false);
    expect(office.materialsCanOverride).toBe(true);
  });

  it("hard: blocks everyone and offers no override", async () => {
    gate({ enforcement: "hard" });
    const owner = await getJobCompletionChecklist("job-001", "owner");
    expect(owner.canComplete).toBe(false);
    expect(owner.materialsCanOverride).toBe(false);
  });

  it("reconciled (or overridden) clears soft and hard", async () => {
    gate({ enforcement: "hard", reconciled: true });
    const checklist = await getJobCompletionChecklist("job-001", "tech");
    expect(checklist.materialsBlocked).toBe(false);
    expect(checklist.canComplete).toBe(true);
  });

  it("a job that does not need reconciling is never blocked", async () => {
    gate({ enforcement: "hard", required: false });
    const checklist = await getJobCompletionChecklist("job-001", "tech");
    expect(checklist.materialsRequired).toBe(false);
    expect(checklist.canComplete).toBe(true);
  });

  it("passes the closeout mode to the gate so visit jobs can be exempt", async () => {
    getJobByIdMock.mockResolvedValue(makeJob({ closeoutMode: "visit" }));
    gate({ required: false });
    await getJobCompletionChecklist("job-001", "tech");
    expect(getMaterialsGateMock).toHaveBeenCalledWith("job-001", "visit");
  });
});

describe("updateJobStatus — materials gate", () => {
  it("refuses completion at soft and names the materials", async () => {
    gate({ enforcement: "soft" });
    await expect(updateJobStatus("job-001", "Completed", { role: "tech" })).rejects.toThrow(
      /materials are not reconciled/,
    );
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("refuses completion at hard", async () => {
    gate({ enforcement: "hard" });
    await expect(updateJobStatus("job-001", "Completed", { role: "owner" })).rejects.toThrow(
      /materials are not reconciled/,
    );
  });

  it("completes at warn with the step still open", async () => {
    gate({ enforcement: "warn" });
    await expect(updateJobStatus("job-001", "Completed", { role: "tech" })).resolves.toBeTruthy();
    expect(updateJobMock).toHaveBeenCalled();
  });

  it("completes once reconciled even at hard", async () => {
    gate({ enforcement: "hard", reconciled: true });
    await expect(updateJobStatus("job-001", "Completed", { role: "tech" })).resolves.toBeTruthy();
  });
});
