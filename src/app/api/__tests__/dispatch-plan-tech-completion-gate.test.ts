/**
 * B10 — Tech-side tightening: a tech must not complete a dispatch plan
 * when the job's own completion gates are unmet.
 *
 * Covered scenarios:
 *   - Tech is blocked when canComplete is false (unmet gates listed)
 *   - Tech is allowed when all gates pass
 *   - Office (and above) bypass the gate check entirely
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  readJsonObjectMock,
  updateDispatchPlanStatusMock,
  getDispatchPlanByIdMock,
  getJobCompletionChecklistMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  readJsonObjectMock: vi.fn(),
  updateDispatchPlanStatusMock: vi.fn(),
  getDispatchPlanByIdMock: vi.fn(),
  getJobCompletionChecklistMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>(
    "@/lib/api-auth",
  );
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/lib/api/routeErrors", () => ({
  readJsonObject: readJsonObjectMock,
  invalidJsonResponse: vi.fn(
    () =>
      new Response(
        JSON.stringify({ error: "INVALID_PAYLOAD", code: 400 }),
        { status: 400 },
      ),
  ),
  mapRouteError: vi.fn((error: unknown) =>
    new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
  ),
  mapRepositoryError: vi.fn(() =>
    new Response(
      JSON.stringify({ error: "REPO_ERROR", code: 500 }),
      { status: 500 },
    ),
  ),
  createApiErrorResponse: vi.fn(
    (code: string, message: string, status: number) =>
      new Response(JSON.stringify({ error: code, message, code: status }), {
        status,
      }),
  ),
}));

vi.mock("@/services/dispatch", () => ({
  assignCrewToPlan: vi.fn(),
  assignPeopleToJob: vi.fn(),
  emitDispatchEvent: vi.fn(),
  movePersonBetweenJobs: vi.fn(),
  schedulePlan: vi.fn(),
}));

vi.mock("@/repositories/dispatch", () => ({
  getDispatchPlanById: getDispatchPlanByIdMock,
  updateDispatchPlanStatus: updateDispatchPlanStatusMock,
}));

vi.mock("@/services/jobs", () => ({
  getJobCompletionChecklist: getJobCompletionChecklistMock,
}));

vi.mock("@/lib/observability/writes", () => ({
  logWriteFailure: vi.fn(),
}));

import { PATCH as patchDispatchPlan } from "@/app/api/dispatch-plans/[id]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authorizedCtx(role = "tech") {
  return { ok: true, ctx: { userId: "user-1", role } };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** A checklist where all gates are unmet (full closeout mode). */
function uncheckableChecklist() {
  return {
    closeoutMode: "full" as const,
    photosUploaded: false,
    installedSystemsEntered: false,
    jobNotesCompleted: false,
    requiredQaItemsComplete: false,
    customerSignaturePlaceholder: "optional" as const,
    finalDayBlocker: null,
    canComplete: false,
  };
}

/** A checklist where everything passes. */
function completeChecklist() {
  return {
    closeoutMode: "full" as const,
    photosUploaded: true,
    installedSystemsEntered: true,
    jobNotesCompleted: true,
    requiredQaItemsComplete: true,
    customerSignaturePlaceholder: "optional" as const,
    finalDayBlocker: null,
    canComplete: true,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/dispatch-plans/[id] action=update_status — tech completion gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks a tech when completion gates are unmet and lists blockers", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx("tech"));
    readJsonObjectMock.mockResolvedValue({
      action: "update_status",
      status: "completed",
    });
    getDispatchPlanByIdMock.mockResolvedValue({
      ok: true,
      data: { id: "dp-1", jobId: "job-1" },
    });
    getJobCompletionChecklistMock.mockResolvedValue(uncheckableChecklist());

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", {
        method: "PATCH",
      }),
      makeParams("dp-1"),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("INVALID_INPUT");
    expect(body.message).toContain("missing at least one photo");
    expect(body.message).toContain("missing installed systems");
    expect(body.message).toContain("missing job notes");
    expect(body.message).toContain("incomplete required QA items");
    // Status write must NOT have been called
    expect(updateDispatchPlanStatusMock).not.toHaveBeenCalled();
  });

  it("blocks a tech with visit-mode gates (note-only)", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx("tech"));
    readJsonObjectMock.mockResolvedValue({
      action: "update_status",
      status: "completed",
    });
    getDispatchPlanByIdMock.mockResolvedValue({
      ok: true,
      data: { id: "dp-1", jobId: "job-1" },
    });
    getJobCompletionChecklistMock.mockResolvedValue({
      ...uncheckableChecklist(),
      closeoutMode: "visit",
    });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", {
        method: "PATCH",
      }),
      makeParams("dp-1"),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("missing job notes");
    // Visit mode must NOT surface full-mode gates
    expect(body.message).not.toContain("photo");
    expect(body.message).not.toContain("installed systems");
    expect(body.message).not.toContain("QA");
  });

  it("blocks a tech with the final-day blocker", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx("tech"));
    readJsonObjectMock.mockResolvedValue({
      action: "update_status",
      status: "completed",
    });
    getDispatchPlanByIdMock.mockResolvedValue({
      ok: true,
      data: { id: "dp-1", jobId: "job-1" },
    });
    getJobCompletionChecklistMock.mockResolvedValue({
      ...completeChecklist(),
      finalDayBlocker:
        "this job runs through 2026-11-10 and cannot be completed before its final scheduled day",
      canComplete: false,
    });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", {
        method: "PATCH",
      }),
      makeParams("dp-1"),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("final scheduled day");
  });

  it("allows a tech when all gates pass", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx("tech"));
    readJsonObjectMock.mockResolvedValue({
      action: "update_status",
      status: "completed",
    });
    getDispatchPlanByIdMock.mockResolvedValue({
      ok: true,
      data: { id: "dp-1", jobId: "job-1" },
    });
    getJobCompletionChecklistMock.mockResolvedValue(completeChecklist());
    updateDispatchPlanStatusMock.mockResolvedValue({
      ok: true,
      data: { id: "dp-1" },
    });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", {
        method: "PATCH",
      }),
      makeParams("dp-1"),
    );

    expect(res.status).toBe(200);
    expect(updateDispatchPlanStatusMock).toHaveBeenCalledWith(
      "dp-1",
      "completed",
    );
  });

  it("lets office role complete even with unmet gates", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx("office"));
    readJsonObjectMock.mockResolvedValue({
      action: "update_status",
      status: "completed",
    });
    updateDispatchPlanStatusMock.mockResolvedValue({
      ok: true,
      data: { id: "dp-1" },
    });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", {
        method: "PATCH",
      }),
      makeParams("dp-1"),
    );

    expect(res.status).toBe(200);
    // Should NOT have loaded the checklist
    expect(getJobCompletionChecklistMock).not.toHaveBeenCalled();
    expect(updateDispatchPlanStatusMock).toHaveBeenCalledWith(
      "dp-1",
      "completed",
    );
  });

  it("lets manager role complete even with unmet gates", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx("manager"));
    readJsonObjectMock.mockResolvedValue({
      action: "update_status",
      status: "completed",
    });
    updateDispatchPlanStatusMock.mockResolvedValue({
      ok: true,
      data: { id: "dp-1" },
    });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", {
        method: "PATCH",
      }),
      makeParams("dp-1"),
    );

    expect(res.status).toBe(200);
    expect(getJobCompletionChecklistMock).not.toHaveBeenCalled();
  });

  it("lets dispatch role complete even with unmet gates", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx("dispatch"));
    readJsonObjectMock.mockResolvedValue({
      action: "update_status",
      status: "completed",
    });
    updateDispatchPlanStatusMock.mockResolvedValue({
      ok: true,
      data: { id: "dp-1" },
    });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", {
        method: "PATCH",
      }),
      makeParams("dp-1"),
    );

    expect(res.status).toBe(200);
    expect(getJobCompletionChecklistMock).not.toHaveBeenCalled();
  });

  it("does not gate-check when target status is not completed", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx("tech"));
    readJsonObjectMock.mockResolvedValue({
      action: "update_status",
      status: "in_progress",
    });
    updateDispatchPlanStatusMock.mockResolvedValue({
      ok: true,
      data: { id: "dp-1" },
    });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", {
        method: "PATCH",
      }),
      makeParams("dp-1"),
    );

    expect(res.status).toBe(200);
    // No checklist load for non-completed status
    expect(getJobCompletionChecklistMock).not.toHaveBeenCalled();
    expect(getDispatchPlanByIdMock).not.toHaveBeenCalled();
  });
});
