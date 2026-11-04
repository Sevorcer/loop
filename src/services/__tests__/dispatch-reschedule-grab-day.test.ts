/**
 * Regression test: rescheduleJobByDayShift translates the grab-day delta
 * correctly for plan-backed jobs. Grabbing a multi-day job on a non-start
 * day must shift by (dropDay − grabDay), not by (dropDay − jobStartDay).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getJobByIdMock = vi.hoisted(() => vi.fn());
const listDispatchPlansByJobIdMock = vi.hoisted(() => vi.fn());
const schedulePlanMock = vi.hoisted(() => vi.fn());
const updateJobMock = vi.hoisted(() => vi.fn());

vi.mock("@/repositories/jobs", () => ({
  getJobById: getJobByIdMock,
  updateJob: updateJobMock,
  createJobActivity: vi.fn(),
  listJobsByIds: vi.fn(),
  setJobPeople: vi.fn(),
}));

vi.mock("@/repositories/dispatch", () => ({
  listDispatchPlansByJobId: listDispatchPlansByJobIdMock,
  getDispatchPlanById: vi.fn(),
  appendDispatchEvent: vi.fn(),
  createDispatchPlan: vi.fn(),
  loadDispatchSnapshot: vi.fn(),
  upsertCrewAssignment: vi.fn(),
  upsertScheduleBlock: vi.fn(),
  updateDispatchPlanPlacement: vi.fn(),
}));

// We mock schedulePlan itself to verify the date it receives
vi.mock("@/services/dispatch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/dispatch")>();
  return {
    ...actual,
    // Keep rescheduleJobByDayShift real; mock schedulePlan
    schedulePlan: schedulePlanMock,
  };
});

import { rescheduleJobByDayShift } from "@/services/dispatch";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    type: "Install",
    customerName: "Test Corp",
    propertyName: "Test Site",
    scheduledStartAt: "2026-11-02T16:00:00.000Z", // Mon Nov 2 at 08:00 PT
    scheduledEndAt: "2026-11-05T00:00:00.000Z",   // Wed Nov 4 at 16:00 PT (3-day job)
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
  schedulePlanMock.mockResolvedValue({ blockResult: {}, statusResult: {} });
  updateJobMock.mockResolvedValue(makeJob());
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

    // schedulePlan should receive the NEW START day: Mon + 2 = Wed
    expect(schedulePlanMock).toHaveBeenCalledTimes(1);
    const input = schedulePlanMock.mock.calls[0][0];
    expect(input.scheduledDate).toBe("2026-11-04");
    // NOT "2026-11-06" (which would be the raw dropDay, yielding +4 delta)
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

    const input = schedulePlanMock.mock.calls[0][0];
    expect(input.scheduledDate).toBe("2026-11-06");
  });

  it("same-day drop is a no-op", async () => {
    getJobByIdMock.mockResolvedValue(makeJob());

    await rescheduleJobByDayShift("job-1", "2026-11-03", "2026-11-03");

    expect(schedulePlanMock).not.toHaveBeenCalled();
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("plan-less job shifts dates directly via computeRescheduleShift", async () => {
    getJobByIdMock.mockResolvedValue(makeJob());
    listDispatchPlansByJobIdMock.mockResolvedValue({
      ok: true,
      data: [],
    });

    await rescheduleJobByDayShift("job-1", "2026-11-04", "2026-11-06");

    expect(schedulePlanMock).not.toHaveBeenCalled();
    expect(updateJobMock).toHaveBeenCalledTimes(1);
    const updateInput = updateJobMock.mock.calls[0][1];
    // Delta = +2, start was Nov 2 → Nov 4, end was Nov 5 → Nov 7
    expect(updateInput.scheduledStartAt).toBe("2026-11-04T16:00:00.000Z");
    expect(updateInput.scheduledEndAt).toBe("2026-11-07T00:00:00.000Z");
  });
});
