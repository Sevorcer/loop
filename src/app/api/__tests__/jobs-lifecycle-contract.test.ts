/**
 * S4.2 — Endpoint contract tests: Job lifecycle routes
 *
 * Covered routes:
 *   GET    /api/jobs
 *   GET    /api/jobs/[id]
 *   PATCH  /api/jobs/[id]  (actions: update, status, note + invalid action)
 *   DELETE /api/jobs/[id]
 *
 * Each route is validated for:
 *   - 401 when unauthenticated
 *   - 403 when role is not permitted
 *   - 200 on the happy path (correct shape, key fields)
 *   - 404 when the job is not found
 *
 * Note: POST /api/jobs is covered by jobs-route-regression.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  readJsonObjectMock,
  listJobsWithActivityMock,
  getJobMock,
  listJobActivityMock,
  updateJobMock,
  updateJobStatusMock,
  addJobNoteMock,
  deleteJobMock,
  createSupabaseServerClientMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  readJsonObjectMock: vi.fn(),
  listJobsWithActivityMock: vi.fn(),
  getJobMock: vi.fn(),
  listJobActivityMock: vi.fn(),
  updateJobMock: vi.fn(),
  updateJobStatusMock: vi.fn(),
  addJobNoteMock: vi.fn(),
  deleteJobMock: vi.fn(),
  createSupabaseServerClientMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/api/routeErrors", () => ({
  readJsonObject: readJsonObjectMock,
  invalidJsonResponse: vi.fn(() =>
    new Response(JSON.stringify({ error: "INVALID_PAYLOAD", code: 400 }), { status: 400 }),
  ),
  mapRouteError: vi.fn((error: unknown) =>
    new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
  ),
}));

vi.mock("@/lib/audit", () => ({ emitAuditEvent: vi.fn() }));

vi.mock("@/services/jobs", () => ({
  listJobsWithActivity: listJobsWithActivityMock,
  getJob: getJobMock,
  listJobActivity: listJobActivityMock,
  updateJob: updateJobMock,
  updateJobStatus: updateJobStatusMock,
  addJobNote: addJobNoteMock,
  deleteJob: deleteJobMock,
  createJob: vi.fn(),
}));

import { GET as getJobs } from "@/app/api/jobs/route";
import {
  DELETE as deleteJobById,
  GET as getJobById,
  PATCH as patchJobById,
} from "@/app/api/jobs/[id]/route";

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

function authorizedCtx(role = "owner") {
  return { ok: true, ctx: { userId: "user-1", role } };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// GET /api/jobs
// ---------------------------------------------------------------------------

describe("GET /api/jobs — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getJobs(new Request("http://localhost/api/jobs"));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.code).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getJobs(new Request("http://localhost/api/jobs"));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("FORBIDDEN");
  });

  it("returns 200 with jobs and activity arrays for an authorized request", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    listJobsWithActivityMock.mockResolvedValue({
      jobs: [{ id: "j-1", title: "Install HVAC" }],
      activity: [{ id: "a-1" }],
    });
    const res = await getJobs(new Request("http://localhost/api/jobs"));
    expect(res.status).toBe(200);
    const body = await res.json() as { jobs: unknown[]; activity: unknown[] };
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(Array.isArray(body.activity)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/jobs/[id]
// ---------------------------------------------------------------------------

describe("GET /api/jobs/[id] — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getJobById(
      new Request("http://localhost/api/jobs/j-1"),
      makeParams("j-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getJobById(
      new Request("http://localhost/api/jobs/j-1"),
      makeParams("j-1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when job does not exist", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    getJobMock.mockResolvedValue(null);
    const res = await getJobById(
      new Request("http://localhost/api/jobs/j-404"),
      makeParams("j-404"),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("NOT_FOUND");
    expect(body.code).toBe(404);
  });

  it("returns 200 with job and activity when found", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    getJobMock.mockResolvedValue({ id: "j-1", title: "Install HVAC" });
    listJobActivityMock.mockResolvedValue([{ id: "a-1" }]);
    const res = await getJobById(
      new Request("http://localhost/api/jobs/j-1"),
      makeParams("j-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { job: { id: string }; activity: unknown[] };
    expect(body.job.id).toBe("j-1");
    expect(Array.isArray(body.activity)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/jobs/[id] — action: update
// ---------------------------------------------------------------------------

describe("PATCH /api/jobs/[id] action=update — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await patchJobById(
      new Request("http://localhost/api/jobs/j-1", { method: "PATCH" }),
      makeParams("j-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await patchJobById(
      new Request("http://localhost/api/jobs/j-1", { method: "PATCH" }),
      makeParams("j-1"),
    );
    expect(res.status).toBe(403);
    expect(updateJobMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown action", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ action: "unknown_action" });
    const res = await patchJobById(
      new Request("http://localhost/api/jobs/j-1", { method: "PATCH" }),
      makeParams("j-1"),
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.code).toBe(400);
  });

  it("returns 404 when job does not exist", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({
      action: "update",
      title: "New Title",
      customerName: "Acme",
      propertyName: "HQ",
      assignedTo: "Tech",
      scheduledFor: "2026-08-01",
      type: "Service",
      priority: "Medium",
      location: "123 Main",
      summary: "",
      notes: "",
    });
    updateJobMock.mockResolvedValue(null);
    const res = await patchJobById(
      new Request("http://localhost/api/jobs/j-404", { method: "PATCH" }),
      makeParams("j-404"),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns 200 with updated job on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({
      action: "update",
      title: "Updated Title",
      customerName: "Acme",
      propertyName: "HQ",
      assignedTo: "Tech",
      scheduledFor: "2026-08-01",
      type: "Service",
      priority: "Medium",
      location: "123 Main",
      summary: "",
      notes: "",
    });
    updateJobMock.mockResolvedValue({ id: "j-1", title: "Updated Title" });
    const res = await patchJobById(
      new Request("http://localhost/api/jobs/j-1", { method: "PATCH" }),
      makeParams("j-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { job: { id: string } };
    expect(body.job.id).toBe("j-1");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/jobs/[id] — action: status
// ---------------------------------------------------------------------------

describe("PATCH /api/jobs/[id] action=status — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with updated job when transitioning status", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ action: "status", status: "In Progress" });
    updateJobStatusMock.mockResolvedValue({ id: "j-1", status: "In Progress" });
    const res = await patchJobById(
      new Request("http://localhost/api/jobs/j-1", { method: "PATCH" }),
      makeParams("j-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { job: { id: string } };
    expect(body.job.id).toBe("j-1");
    expect(updateJobStatusMock).toHaveBeenCalledWith("j-1", "In Progress");
  });

  it("returns 404 when job not found during status transition", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ action: "status", status: "Completed" });
    updateJobStatusMock.mockResolvedValue(null);
    const res = await patchJobById(
      new Request("http://localhost/api/jobs/j-404", { method: "PATCH" }),
      makeParams("j-404"),
    );
    expect(res.status).toBe(404);
  });

  it("propagates a transition error from the service when the move is not allowed", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ action: "status", status: "In Progress" });
    updateJobStatusMock.mockRejectedValue(
      new Error("Invalid transition: job cannot move from 'Completed' to 'In Progress'."),
    );
    const res = await patchJobById(
      new Request("http://localhost/api/jobs/j-1", { method: "PATCH" }),
      makeParams("j-1"),
    );
    expect(res.status).not.toBe(200);
    expect(updateJobStatusMock).toHaveBeenCalledWith("j-1", "In Progress");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/jobs/[id] — action: note
// ---------------------------------------------------------------------------

describe("PATCH /api/jobs/[id] action=note — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with updated job when adding a note", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ action: "note", note: "Check breaker panel." });
    addJobNoteMock.mockResolvedValue({ id: "j-1" });
    const res = await patchJobById(
      new Request("http://localhost/api/jobs/j-1", { method: "PATCH" }),
      makeParams("j-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { job: { id: string } };
    expect(body.job.id).toBe("j-1");
    expect(addJobNoteMock).toHaveBeenCalledWith("j-1", "Check breaker panel.");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/jobs/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/jobs/[id] — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await deleteJobById(
      new Request("http://localhost/api/jobs/j-1", { method: "DELETE" }),
      makeParams("j-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await deleteJobById(
      new Request("http://localhost/api/jobs/j-1", { method: "DELETE" }),
      makeParams("j-1"),
    );
    expect(res.status).toBe(403);
    expect(deleteJobMock).not.toHaveBeenCalled();
  });

  it("returns 404 when job does not exist", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    deleteJobMock.mockResolvedValue(null);
    const res = await deleteJobById(
      new Request("http://localhost/api/jobs/j-404", { method: "DELETE" }),
      makeParams("j-404"),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns 200 with deleted id on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    deleteJobMock.mockResolvedValue(true);
    const res = await deleteJobById(
      new Request("http://localhost/api/jobs/j-1", { method: "DELETE" }),
      makeParams("j-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; message: string };
    expect(body.id).toBe("j-1");
    expect(typeof body.message).toBe("string");
  });
});
