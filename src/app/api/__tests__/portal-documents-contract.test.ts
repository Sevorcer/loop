/**
 * S4.2 — Endpoint contract tests: Customer Portal and Document routes
 *
 * Covered routes:
 *   GET  /api/portal-projects          — list all portal projects
 *   GET  /api/portal-projects?projectId — load full project bundle
 *   GET  /api/documents
 *   POST /api/documents
 *
 * Each route is validated for:
 *   - 401 when unauthenticated
 *   - 403 when role is not permitted
 *   - 200/201 on the happy path (correct shape, key fields)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  getPortalProjectsMock,
  getPortalProjectBundleMock,
  documentsServiceListMock,
  documentsServiceCreateMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getPortalProjectsMock: vi.fn(),
  getPortalProjectBundleMock: vi.fn(),
  documentsServiceListMock: vi.fn(),
  documentsServiceCreateMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/lib/api/routeErrors", () => ({
  invalidJsonResponse: vi.fn(() =>
    new Response(JSON.stringify({ error: "INVALID_PAYLOAD", code: 400 }), { status: 400 }),
  ),
  mapRouteError: vi.fn((error: unknown) =>
    new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
  ),
  mapRepositoryError: vi.fn(() =>
    new Response(JSON.stringify({ error: "REPO_ERROR", code: 500 }), { status: 500 }),
  ),
}));

vi.mock("@/lib/audit", () => ({ emitAuditEvent: vi.fn() }));

vi.mock("@/services/portalProjects", () => ({
  getPortalProjects: getPortalProjectsMock,
  getPortalProjectBundle: getPortalProjectBundleMock,
}));

// The documents route calls createDocumentsService() at module level.
// Return a factory mock so the module-level call yields our mock service.
vi.mock("@/services/domain/documentsService", () => ({
  createDocumentsService: () => ({
    list: documentsServiceListMock,
    create: documentsServiceCreateMock,
  }),
}));

import { GET as getPortalProjects } from "@/app/api/portal-projects/route";
import {
  GET as getDocuments,
  POST as postDocument,
} from "@/app/api/documents/route";

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

// ---------------------------------------------------------------------------
// GET /api/portal-projects — list
// ---------------------------------------------------------------------------

describe("GET /api/portal-projects — list contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getPortalProjects(new Request("http://localhost/api/portal-projects"));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.code).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getPortalProjects(new Request("http://localhost/api/portal-projects"));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("FORBIDDEN");
  });

  it("returns 200 with projects array for an authorized request", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    getPortalProjectsMock.mockResolvedValue([{ id: "proj-1" }]);
    const res = await getPortalProjects(new Request("http://localhost/api/portal-projects"));
    expect(res.status).toBe(200);
    const body = await res.json() as { projects: Array<{ id: string }> };
    expect(Array.isArray(body.projects)).toBe(true);
    expect(body.projects[0].id).toBe("proj-1");
  });
});

// ---------------------------------------------------------------------------
// GET /api/portal-projects?projectId= — bundle
// ---------------------------------------------------------------------------

describe("GET /api/portal-projects?projectId — bundle contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with project bundle when projectId is provided", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    getPortalProjectBundleMock.mockResolvedValue({
      project: { id: "proj-1" },
      milestones: [],
      documents: [],
      photos: [],
    });
    const res = await getPortalProjects(
      new Request("http://localhost/api/portal-projects?projectId=proj-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { project: { id: string } };
    expect(body.project.id).toBe("proj-1");
    expect(getPortalProjectBundleMock).toHaveBeenCalledWith("proj-1");
    expect(getPortalProjectsMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/documents
// ---------------------------------------------------------------------------

describe("GET /api/documents — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getDocuments(new Request("http://localhost/api/documents"));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getDocuments(new Request("http://localhost/api/documents"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with documents array for an authorized request", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    documentsServiceListMock.mockResolvedValue({ ok: true, data: { items: [{ id: "doc-1" }] } });
    const res = await getDocuments(new Request("http://localhost/api/documents"));
    expect(res.status).toBe(200);
    const body = await res.json() as { documents: Array<{ id: string }> };
    expect(Array.isArray(body.documents)).toBe(true);
    expect(body.documents[0].id).toBe("doc-1");
  });
});

// ---------------------------------------------------------------------------
// POST /api/documents
// ---------------------------------------------------------------------------

describe("POST /api/documents — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await postDocument(
      new Request("http://localhost/api/documents", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await postDocument(
      new Request("http://localhost/api/documents", { method: "POST" }),
    );
    expect(res.status).toBe(403);
    expect(documentsServiceCreateMock).not.toHaveBeenCalled();
  });

  it("returns 201 with created document on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    documentsServiceCreateMock.mockResolvedValue({
      ok: true,
      data: { id: "doc-new", projectId: "proj-1" },
    });

    const res = await postDocument(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: "proj-1" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { document: { id: string }; message: string };
    expect(body.document.id).toBe("doc-new");
    expect(typeof body.message).toBe("string");
    expect(documentsServiceCreateMock).toHaveBeenCalledOnce();
  });
});
