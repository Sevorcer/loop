/**
 * Regression test: rescheduleJobByDayShift translates the grab-day delta
 * correctly for plan-backed jobs. Grabbing a multi-day job on a non-start
 * day must shift by (dropDay − grabDay), not by (dropDay − jobStartDay).
 *
 * The plan path runs the REAL schedulePlan (intra-module calls cannot be
 * intercepted by mocking the module's own export), so these tests mock the
 * repository layer and assert on schedulePlan's observable effects: the job
 * date update and the plan placement.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/services/inventoryReservations", () => ({ releaseAndRecheck: vi.fn(async () => undefined) }));
vi.mock("@/services/closeoutReconciliation", () => ({
  getMaterialsGate: vi.fn(async () => ({ required: false, reconciled: false, enforcement: "warn" })),
}));

const getJobByIdMock = vi.hoisted(() => vi.fn());
const updateJobMock = vi.hoisted(() => vi.fn());
const listDispatchPlansByJobIdMock = vi.hoisted(() => vi.fn());
const getDispatchPlanByIdMock = vi.hoisted(() => vi.fn());
const upsertScheduleBlockMock = vi.hoisted(() => vi.fn());
const updateDispatchPlanPlacementMock = vi.hoisted(() => vi.fn());

vi.mock("@/repositories/jobs", () => ({
  getJobById: getJobByIdMock,
  updateJob: updateJobMock,
  createJobActivity: vi.fn(),
  listJobsByIds: vi.fn(),
  setJobPeople: vi.fn(),
}));

vi.mock("@/repositories/dispatch", () => ({
  listDispatchPlansByJobId: listDispatchPlansByJobIdMock,
  getDispatchPlanById: getDispatchPlanByIdMock,
  appendDispatchEvent: vi.fn(),
  createDispatchPlan: vi.fn(),
  loadDispatchSnapshot: vi.fn(),
  upsertCrewAssignment: vi.fn(),
  upsertScheduleBlock: upsertScheduleBlockMock,
  updateDispatchPlanPlacement: updateDispatchPlanPlacementMock,
}));

import { rescheduleJobByDayShift } from "@/services/dispatch";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    type: "Install",
    customerName: "Test Corp",
    propertyName: "Test Site",
    scheduledStartAt: "2026-11-02T16:00:00.000Z", // Mon Nov 2 at 08:00 PT
    scheduledEndAt: "2026-11-05T00:00:00.000Z", // Wed Nov 4 at 16:00 PT (3-day job)
    ...overrides,
  };
}

const PLAN = {
  id: "plan-1",
  jobId: "job-1",
  jobType: "Install",
  customerName: "Test Corp",
  propertyName: "Test Site",
  estimatedDurationHours: 8,
};

beforeEach(() => {
  vi.clearAllMocks();
  updateJobMock.mockResolvedValue(makeJob());
  getDispatchPlanByIdMock.mockResolvedValue({ ok: true, data: PLAN });
  upsertScheduleBlockMock.mockResolvedValue({ ok: true, data: null });
  updateDispatchPlanPlacementMock.mockResolvedValue({ ok: true, data: null });
});

describe("rescheduleJobByDayShift — grab-day translation", () => {
  it("shifts a plan-backed job by grab-to-drop delta, not start-to-drop", async () => {
    // Mon–Wed job, grab WEDNESDAY (day 3), drop FRIDAY → delta = +2
    getJobByIdMock.mockResolvedValue(makeJob());
    listDispatchPlansByJobIdMock.mockResolvedValue({
      ok: true,
      data: [PLAN],
    });

    await rescheduleJobByDayShift("job-1", "2026-11-04", "2026-11-06");

    // The plan placement lands on the NEW START day: Mon + 2 = Wed Nov 4,
    // NOT the raw drop day Fri Nov 6 (which would mean a +4 shift).
    expect(updateDispatchPlanPlacementMock).toHaveBeenCalledTimes(1);
    expect(updateDispatchPlanPlacementMock.mock.calls[0][1].targetDate).toBe(
      "2026-11-04",
    );

    // The job's own dates shift by exactly +2, preserving the 3-day span.
    expect(updateJobMock).toHaveBeenCalledTimes(1);
    const updateInput = updateJobMock.mock.calls[0][1];
    expect(updateInput.scheduledFor).toBe("2026-11-04");
    expect(updateInput.scheduledStartAt).toBe("2026-11-04T16:00:00.000Z");
    expect(updateInput.scheduledEndAt).toBe("2026-11-07T00:00:00.000Z");
  });

  it("grab on the start day produces the same result as the drop day", async () => {
    // Mon–Wed job, grab MONDAY (start), drop FRIDAY → delta = +4
    // newStartDay = Mon + 4 = Fri = dropDay (identity case)
    getJobByIdMock.mockResolvedValue(makeJob());
    listDispatchPlansByJobIdMock.mockResolvedValue({
      ok: true,
      data: [PLAN],
    });

    await rescheduleJobByDayShift("job-1", "2026-11-02", "2026-11-06");

    expect(updateDispatchPlanPlacementMock).toHaveBeenCalledTimes(1);
    expect(updateDispatchPlanPlacementMock.mock.calls[0][1].targetDate).toBe(
      "2026-11-06",
    );
    const updateInput = updateJobMock.mock.calls[0][1];
    expect(updateInput.scheduledStartAt).toBe("2026-11-06T16:00:00.000Z");
    expect(updateInput.scheduledEndAt).toBe("2026-11-09T00:00:00.000Z");
  });

  it("same-day drop is a no-op", async () => {
    getJobByIdMock.mockResolvedValue(makeJob());

    await rescheduleJobByDayShift("job-1", "2026-11-03", "2026-11-03");

    expect(updateJobMock).not.toHaveBeenCalled();
    expect(updateDispatchPlanPlacementMock).not.toHaveBeenCalled();
  });

  it("plan-less job shifts dates directly via computeRescheduleShift", async () => {
    getJobByIdMock.mockResolvedValue(makeJob());
    listDispatchPlansByJobIdMock.mockResolvedValue({
      ok: true,
      data: [],
    });

    await rescheduleJobByDayShift("job-1", "2026-11-04", "2026-11-06");

    expect(updateDispatchPlanPlacementMock).not.toHaveBeenCalled();
    expect(updateJobMock).toHaveBeenCalledTimes(1);
    const updateInput = updateJobMock.mock.calls[0][1];
    // Delta = +2, start was Nov 2 → Nov 4, end was Nov 5 → Nov 7
    expect(updateInput.scheduledStartAt).toBe("2026-11-04T16:00:00.000Z");
    expect(updateInput.scheduledEndAt).toBe("2026-11-07T00:00:00.000Z");
  });
});
