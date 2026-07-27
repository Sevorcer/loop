/**
 * S4.2 — Endpoint contract tests: Property routes
 *
 * Covered routes:
 *   GET    /api/properties
 *   GET    /api/properties/[id]
 *   PATCH  /api/properties/[id]
 *   DELETE /api/properties/[id]
 *   GET    /api/properties/[id]/jobs
 *   GET    /api/properties/[id]/artifacts
 *
 * Each route is validated for:
 *   - 401 when unauthenticated
 *   - 403 when role is not permitted
 *   - 200/201 on the happy path (correct shape, key fields)
 *   - 404 when the resource is not found (write/read by id)
 *
 * Note: POST /api/properties is covered by properties-route-sentinels.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  readJsonObjectMock,
  listPropertiesMock,
  getPropertyMock,
  updatePropertyMock,
  deletePropertyMock,
  listJobsForPropertyMock,
  getPropertyArtifactsMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  readJsonObjectMock: vi.fn(),
  listPropertiesMock: vi.fn(),
  getPropertyMock: vi.fn(),
  updatePropertyMock: vi.fn(),
  deletePropertyMock: vi.fn(),
  listJobsForPropertyMock: vi.fn(),
  getPropertyArtifactsMock: vi.fn(),
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
}));

vi.mock("@/lib/audit", () => ({ emitAuditEvent: vi.fn() }));

vi.mock("@/services/properties", () => ({
  listProperties: listPropertiesMock,
  getProperty: getPropertyMock,
  updateProperty: updatePropertyMock,
  deleteProperty: deletePropertyMock,
}));

vi.mock("@/services/jobs", () => ({
  listJobsForProperty: listJobsForPropertyMock,
}));

vi.mock("@/services/propertyArtifacts", () => ({
  getPropertyArtifacts: getPropertyArtifactsMock,
}));

import { GET as getProperties } from "@/app/api/properties/route";
import {
  DELETE as deletePropertyById,
  GET as getPropertyById,
  PATCH as patchPropertyById,
} from "@/app/api/properties/[id]/route";
import { GET as getPropertyJobs } from "@/app/api/properties/[id]/jobs/route";
import { GET as getPropertyArtifacts } from "@/app/api/properties/[id]/artifacts/route";

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
// GET /api/properties
// ---------------------------------------------------------------------------

describe("GET /api/properties — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getProperties(new Request("http://localhost/api/properties"));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.code).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getProperties(new Request("http://localhost/api/properties"));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("FORBIDDEN");
  });

  it("returns 200 with properties array for an authorized request", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    listPropertiesMock.mockResolvedValue([{ id: "p-1", name: "Main St" }]);
    const res = await getProperties(new Request("http://localhost/api/properties"));
    expect(res.status).toBe(200);
    const body = await res.json() as { properties: Array<{ id: string }> };
    expect(Array.isArray(body.properties)).toBe(true);
    expect(body.properties[0].id).toBe("p-1");
  });
});

// ---------------------------------------------------------------------------
// GET /api/properties/[id]
// ---------------------------------------------------------------------------

describe("GET /api/properties/[id] — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getPropertyById(
      new Request("http://localhost/api/properties/p-1"),
      makeParams("p-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getPropertyById(
      new Request("http://localhost/api/properties/p-1"),
      makeParams("p-1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when property does not exist", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    getPropertyMock.mockResolvedValue(null);
    const res = await getPropertyById(
      new Request("http://localhost/api/properties/p-404"),
      makeParams("p-404"),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("NOT_FOUND");
    expect(body.code).toBe(404);
  });

  it("returns 200 with property when found", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    getPropertyMock.mockResolvedValue({ id: "p-1", name: "Main St" });
    const res = await getPropertyById(
      new Request("http://localhost/api/properties/p-1"),
      makeParams("p-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { property: { id: string } };
    expect(body.property.id).toBe("p-1");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/properties/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/properties/[id] — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await patchPropertyById(
      new Request("http://localhost/api/properties/p-1", { method: "PATCH" }),
      makeParams("p-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await patchPropertyById(
      new Request("http://localhost/api/properties/p-1", { method: "PATCH" }),
      makeParams("p-1"),
    );
    expect(res.status).toBe(403);
    expect(updatePropertyMock).not.toHaveBeenCalled();
  });

  it("returns 404 when property does not exist", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ name: "Updated" });
    updatePropertyMock.mockResolvedValue(null);
    const res = await patchPropertyById(
      new Request("http://localhost/api/properties/p-404", { method: "PATCH" }),
      makeParams("p-404"),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns 200 with property and geocodeStatus on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ name: "Updated Name" });
    updatePropertyMock.mockResolvedValue({
      property: { id: "p-1", name: "Updated Name" },
      geocodeStatus: "skipped",
    });
    const res = await patchPropertyById(
      new Request("http://localhost/api/properties/p-1", { method: "PATCH" }),
      makeParams("p-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { property: { id: string }; geocodeStatus: string };
    expect(body.property.id).toBe("p-1");
    expect(typeof body.geocodeStatus).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/properties/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/properties/[id] — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await deletePropertyById(
      new Request("http://localhost/api/properties/p-1", { method: "DELETE" }),
      makeParams("p-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await deletePropertyById(
      new Request("http://localhost/api/properties/p-1", { method: "DELETE" }),
      makeParams("p-1"),
    );
    expect(res.status).toBe(403);
    expect(deletePropertyMock).not.toHaveBeenCalled();
  });

  it("returns 404 when property does not exist", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    deletePropertyMock.mockResolvedValue(null);
    const res = await deletePropertyById(
      new Request("http://localhost/api/properties/p-404", { method: "DELETE" }),
      makeParams("p-404"),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns 200 with deleted id on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    deletePropertyMock.mockResolvedValue(true);
    const res = await deletePropertyById(
      new Request("http://localhost/api/properties/p-1", { method: "DELETE" }),
      makeParams("p-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; message: string };
    expect(body.id).toBe("p-1");
    expect(typeof body.message).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// GET /api/properties/[id]/jobs
// ---------------------------------------------------------------------------

describe("GET /api/properties/[id]/jobs — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getPropertyJobs(
      new Request("http://localhost/api/properties/p-1/jobs"),
      makeParams("p-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getPropertyJobs(
      new Request("http://localhost/api/properties/p-1/jobs"),
      makeParams("p-1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with jobs array for an authorized request", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    listJobsForPropertyMock.mockResolvedValue([{ id: "j-1" }]);
    const res = await getPropertyJobs(
      new Request("http://localhost/api/properties/p-1/jobs"),
      makeParams("p-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { jobs: Array<{ id: string }> };
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(body.jobs[0].id).toBe("j-1");
  });
});

// ---------------------------------------------------------------------------
// GET /api/properties/[id]/artifacts
// ---------------------------------------------------------------------------

describe("GET /api/properties/[id]/artifacts — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when property_documents guard fails", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getPropertyArtifacts(
      new Request("http://localhost/api/properties/p-1/artifacts"),
      makeParams("p-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when property_photos guard fails after documents passes", async () => {
    // First call (documents) passes, second call (photos) fails with 403.
    requirePermissionMock
      .mockResolvedValueOnce(authorizedCtx())
      .mockResolvedValueOnce(forbiddenResponse());
    const res = await getPropertyArtifacts(
      new Request("http://localhost/api/properties/p-1/artifacts"),
      makeParams("p-1"),
    );
    expect(res.status).toBe(403);
    expect(getPropertyArtifactsMock).not.toHaveBeenCalled();
  });

  it("returns 200 with documents and photos when both guards pass", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    getPropertyArtifactsMock.mockResolvedValue({
      documents: [{ id: "doc-1" }],
      photos: [{ id: "photo-1" }],
    });
    const res = await getPropertyArtifacts(
      new Request("http://localhost/api/properties/p-1/artifacts"),
      makeParams("p-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { documents: unknown[]; photos: unknown[] };
    expect(Array.isArray(body.documents)).toBe(true);
    expect(Array.isArray(body.photos)).toBe(true);
  });
});
