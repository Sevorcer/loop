/**
 * S4.2 — Endpoint contract tests: Dispatch routes
 *
 * Covered routes:
 *   GET    /api/dispatch
 *   GET    /api/dispatch-plans
 *   POST   /api/dispatch-plans
 *   PATCH  /api/dispatch-plans/[id]  (actions: assign_crew, schedule, update_status + invalid)
 *
 * Each route is validated for:
 *   - 401 when unauthenticated
 *   - 403 when role is not permitted
 *   - 200/201 on the happy path (correct shape, key fields)
 *   - 400 for unknown PATCH action
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  readJsonObjectMock,
  loadDispatchSnapshotMock,
  createPlanMock,
  assignCrewToPlanMock,
  schedulePlanMock,
  emitDispatchEventMock,
  updateDispatchPlanStatusMock,
  listJobsWithActivityMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  readJsonObjectMock: vi.fn(),
  loadDispatchSnapshotMock: vi.fn(),
  createPlanMock: vi.fn(),
  assignCrewToPlanMock: vi.fn(),
  schedulePlanMock: vi.fn(),
  emitDispatchEventMock: vi.fn(),
  updateDispatchPlanStatusMock: vi.fn(),
  listJobsWithActivityMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/lib/api/routeErrors", () => ({
  readJsonObject: readJsonObjectMock,
  invalidJsonResponse: vi.fn(() =>
    new Response(JSON.stringify({ error: "INVALID_PAYLOAD", code: 400 }), { status: 400 }),
  ),
  mapRouteError: vi.fn((error: unknown) =>
    new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
  ),
  mapRepositoryError: vi.fn(() =>
    new Response(JSON.stringify({ error: "REPO_ERROR", code: 500 }), { status: 500 }),
  ),
  createApiErrorResponse: vi.fn((code: string, message: string, status: number) =>
    new Response(JSON.stringify({ error: code, message, code: status }), { status }),
  ),
}));

vi.mock("@/services/dispatch", () => ({
  loadDispatchSnapshot: loadDispatchSnapshotMock,
  createPlan: createPlanMock,
  assignCrewToPlan: assignCrewToPlanMock,
  schedulePlan: schedulePlanMock,
  emitDispatchEvent: emitDispatchEventMock,
}));

vi.mock("@/repositories/dispatch", () => ({
  updateDispatchPlanStatus: updateDispatchPlanStatusMock,
}));

vi.mock("@/services/jobs", () => ({
  listJobsWithActivity: listJobsWithActivityMock,
}));

import { GET as getDispatchBoard } from "@/app/api/dispatch/route";
import {
  GET as getDispatchPlans,
  POST as postDispatchPlan,
} from "@/app/api/dispatch-plans/route";
import { PATCH as patchDispatchPlan } from "@/app/api/dispatch-plans/[id]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unauthorizedResponse() {
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ error: "UNAUTHORIZED", message: "A valid session is required.", code: 401 }),
      { status: 401 },
    ),
  };
}

function forbiddenResponse() {
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ error: "FORBIDDEN", message: "Role 'viewer' is not permitted.", code: 403 }),
      { status: 403 },
    ),
  };
}

function authorizedCtx(role = "dispatch") {
  return { ok: true, ctx: { userId: "user-1", role } };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// GET /api/dispatch
// ---------------------------------------------------------------------------

describe("GET /api/dispatch — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getDispatchBoard(new Request("http://localhost/api/dispatch"));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.code).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getDispatchBoard(new Request("http://localhost/api/dispatch"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with jobs array for an authorized request", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    listJobsWithActivityMock.mockResolvedValue({
      jobs: [{ id: "j-1" }],
      activity: [],
    });
    const res = await getDispatchBoard(new Request("http://localhost/api/dispatch"));
    expect(res.status).toBe(200);
    const body = await res.json() as { jobs: unknown[] };
    expect(Array.isArray(body.jobs)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/dispatch-plans
// ---------------------------------------------------------------------------

describe("GET /api/dispatch-plans — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getDispatchPlans(new Request("http://localhost/api/dispatch-plans"));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getDispatchPlans(new Request("http://localhost/api/dispatch-plans"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with snapshot payload for an authorized request", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    loadDispatchSnapshotMock.mockResolvedValue({
      plans: [{ id: "dp-1" }],
      crews: [],
      assignments: [],
      scheduleBlocks: [],
      events: [],
    });
    const res = await getDispatchPlans(new Request("http://localhost/api/dispatch-plans"));
    expect(res.status).toBe(200);
    const body = await res.json() as { plans: unknown[] };
    expect(Array.isArray(body.plans)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/dispatch-plans
// ---------------------------------------------------------------------------

describe("POST /api/dispatch-plans — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await postDispatchPlan(
      new Request("http://localhost/api/dispatch-plans", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await postDispatchPlan(
      new Request("http://localhost/api/dispatch-plans", { method: "POST" }),
    );
    expect(res.status).toBe(403);
    expect(createPlanMock).not.toHaveBeenCalled();
  });

  it("returns 201 with created plan on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({
      jobNumber: "JOB-001",
      customerName: "Acme Corp",
      propertyName: "HQ",
      jobType: "Install",
      dispatchStatus: "ready_to_schedule",
      priority: "normal",
    });
    createPlanMock.mockResolvedValue({ ok: true, data: { id: "dp-1" } });

    const res = await postDispatchPlan(
      new Request("http://localhost/api/dispatch-plans", { method: "POST" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { plan: { id: string } };
    expect(body.plan.id).toBe("dp-1");
    expect(createPlanMock).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/dispatch-plans/[id] — action: assign_crew
// ---------------------------------------------------------------------------

describe("PATCH /api/dispatch-plans/[id] action=assign_crew — contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitDispatchEventMock.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", { method: "PATCH" }),
      makeParams("dp-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", { method: "PATCH" }),
      makeParams("dp-1"),
    );
    expect(res.status).toBe(403);
    expect(assignCrewToPlanMock).not.toHaveBeenCalled();
  });

  it("returns 200 with assignment on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({
      action: "assign_crew",
      crewId: "crew-1",
      crewName: "Alpha Crew",
      leadInstaller: "John Smith",
      supportingTechnicians: [],
    });
    assignCrewToPlanMock.mockResolvedValue({ ok: true, data: { id: "assign-1" } });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", { method: "PATCH" }),
      makeParams("dp-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { assignment: { id: string } };
    expect(body.assignment.id).toBe("assign-1");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/dispatch-plans/[id] — action: schedule
// ---------------------------------------------------------------------------

describe("PATCH /api/dispatch-plans/[id] action=schedule — contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitDispatchEventMock.mockResolvedValue(undefined);
  });

  it("returns 200 with block on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({
      action: "schedule",
      scheduledDate: "2026-08-15",
      scheduledStartTime: "08:00",
      scheduledEndTime: "16:00",
      estimatedDurationHours: 8,
      crewName: "Alpha Crew",
      jobType: "Install",
      customerName: "Acme",
      propertyName: "HQ",
    });
    schedulePlanMock.mockResolvedValue({
      blockResult: { ok: true, data: { id: "block-1" } },
    });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", { method: "PATCH" }),
      makeParams("dp-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { block: { id: string } };
    expect(body.block.id).toBe("block-1");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/dispatch-plans/[id] — action: update_status
// ---------------------------------------------------------------------------

describe("PATCH /api/dispatch-plans/[id] action=update_status — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with updated plan on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ action: "update_status", status: "scheduled" });
    updateDispatchPlanStatusMock.mockResolvedValue({ ok: true, data: { id: "dp-1" } });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", { method: "PATCH" }),
      makeParams("dp-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { plan: { id: string } };
    expect(body.plan.id).toBe("dp-1");
    expect(updateDispatchPlanStatusMock).toHaveBeenCalledWith("dp-1", "scheduled");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/dispatch-plans/[id] — unknown action
// ---------------------------------------------------------------------------

describe("PATCH /api/dispatch-plans/[id] unknown action — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for an unknown action", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ action: "do_something_weird" });

    const res = await patchDispatchPlan(
      new Request("http://localhost/api/dispatch-plans/dp-1", { method: "PATCH" }),
      makeParams("dp-1"),
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("INVALID_INPUT");
  });
});
