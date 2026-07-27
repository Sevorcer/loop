/**
 * S4.2 — Endpoint contract tests: Customer routes
 *
 * Covered routes:
 *   GET    /api/customers
 *   POST   /api/customers
 *   GET    /api/customers/[id]
 *   PATCH  /api/customers/[id]
 *   DELETE /api/customers/[id]
 *   GET    /api/customers/[id]/properties
 *   GET    /api/customers/[id]/jobs
 *
 * Each route is validated for:
 *   - 401 when unauthenticated (requirePermission returns unauthorized)
 *   - 403 when role is not permitted
 *   - 200/201 on the happy path (correct shape, key fields)
 *   - 404 when the resource is not found (write/read by id)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  readJsonObjectMock,
  listCustomersMock,
  createCustomerMock,
  getCustomerMock,
  updateCustomerMock,
  deleteCustomerMock,
  listPropertiesForCustomerMock,
  listJobsForCustomerMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  readJsonObjectMock: vi.fn(),
  listCustomersMock: vi.fn(),
  createCustomerMock: vi.fn(),
  getCustomerMock: vi.fn(),
  updateCustomerMock: vi.fn(),
  deleteCustomerMock: vi.fn(),
  listPropertiesForCustomerMock: vi.fn(),
  listJobsForCustomerMock: vi.fn(),
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

vi.mock("@/services/customers", () => ({
  listCustomers: listCustomersMock,
  createCustomer: createCustomerMock,
  getCustomer: getCustomerMock,
  updateCustomer: updateCustomerMock,
  deleteCustomer: deleteCustomerMock,
}));

vi.mock("@/services/properties", () => ({
  listPropertiesForCustomer: listPropertiesForCustomerMock,
}));

vi.mock("@/services/jobs", () => ({
  listJobsForCustomer: listJobsForCustomerMock,
}));

// Static imports resolve after vi.mock hoisting.
import {
  GET as getCustomers,
  POST as postCustomer,
} from "@/app/api/customers/route";
import {
  DELETE as deleteCustomerById,
  GET as getCustomerById,
  PATCH as patchCustomerById,
} from "@/app/api/customers/[id]/route";
import { GET as getCustomerProperties } from "@/app/api/customers/[id]/properties/route";
import { GET as getCustomerJobs } from "@/app/api/customers/[id]/jobs/route";

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
// GET /api/customers
// ---------------------------------------------------------------------------

describe("GET /api/customers — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getCustomers(new Request("http://localhost/api/customers"));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.code).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getCustomers(new Request("http://localhost/api/customers"));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("FORBIDDEN");
  });

  it("returns 200 with customers array for an authorized request", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    listCustomersMock.mockResolvedValue([{ id: "c-1", name: "Acme" }]);
    const res = await getCustomers(new Request("http://localhost/api/customers"));
    expect(res.status).toBe(200);
    const body = await res.json() as { customers: Array<{ id: string }> };
    expect(Array.isArray(body.customers)).toBe(true);
    expect(body.customers[0].id).toBe("c-1");
  });
});

// ---------------------------------------------------------------------------
// POST /api/customers
// ---------------------------------------------------------------------------

describe("POST /api/customers — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await postCustomer(new Request("http://localhost/api/customers", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await postCustomer(new Request("http://localhost/api/customers", { method: "POST" }));
    expect(res.status).toBe(403);
    expect(createCustomerMock).not.toHaveBeenCalled();
  });

  it("returns 201 with customer on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({
      name: "Acme Corp",
      primaryContact: "Jane Doe",
      email: "jane@acme.com",
      phone: "403-555-0100",
      city: "Calgary",
      status: "Active",
    });
    createCustomerMock.mockResolvedValue({ id: "c-new", name: "Acme Corp" });

    const res = await postCustomer(new Request("http://localhost/api/customers", { method: "POST" }));
    expect(res.status).toBe(201);
    const body = await res.json() as { customer: { id: string } };
    expect(body.customer.id).toBe("c-new");
    expect(createCustomerMock).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// GET /api/customers/[id]
// ---------------------------------------------------------------------------

describe("GET /api/customers/[id] — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getCustomerById(
      new Request("http://localhost/api/customers/c-1"),
      makeParams("c-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getCustomerById(
      new Request("http://localhost/api/customers/c-1"),
      makeParams("c-1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when customer does not exist", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    getCustomerMock.mockResolvedValue(null);
    const res = await getCustomerById(
      new Request("http://localhost/api/customers/c-404"),
      makeParams("c-404"),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("NOT_FOUND");
    expect(body.code).toBe(404);
  });

  it("returns 200 with customer when found", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    getCustomerMock.mockResolvedValue({ id: "c-1", name: "Acme Corp" });
    const res = await getCustomerById(
      new Request("http://localhost/api/customers/c-1"),
      makeParams("c-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { customer: { id: string } };
    expect(body.customer.id).toBe("c-1");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/customers/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/customers/[id] — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await patchCustomerById(
      new Request("http://localhost/api/customers/c-1", { method: "PATCH" }),
      makeParams("c-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await patchCustomerById(
      new Request("http://localhost/api/customers/c-1", { method: "PATCH" }),
      makeParams("c-1"),
    );
    expect(res.status).toBe(403);
    expect(updateCustomerMock).not.toHaveBeenCalled();
  });

  it("returns 404 when customer does not exist", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ name: "Updated" });
    updateCustomerMock.mockResolvedValue(null);
    const res = await patchCustomerById(
      new Request("http://localhost/api/customers/c-404", { method: "PATCH" }),
      makeParams("c-404"),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns 200 with updated customer on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    readJsonObjectMock.mockResolvedValue({ name: "Acme Updated" });
    updateCustomerMock.mockResolvedValue({ id: "c-1", name: "Acme Updated" });
    const res = await patchCustomerById(
      new Request("http://localhost/api/customers/c-1", { method: "PATCH" }),
      makeParams("c-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { customer: { id: string } };
    expect(body.customer.id).toBe("c-1");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/customers/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/customers/[id] — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await deleteCustomerById(
      new Request("http://localhost/api/customers/c-1", { method: "DELETE" }),
      makeParams("c-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await deleteCustomerById(
      new Request("http://localhost/api/customers/c-1", { method: "DELETE" }),
      makeParams("c-1"),
    );
    expect(res.status).toBe(403);
    expect(deleteCustomerMock).not.toHaveBeenCalled();
  });

  it("returns 404 when customer does not exist", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    deleteCustomerMock.mockResolvedValue(null);
    const res = await deleteCustomerById(
      new Request("http://localhost/api/customers/c-404", { method: "DELETE" }),
      makeParams("c-404"),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; code: number };
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns 200 with deleted id on success", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    deleteCustomerMock.mockResolvedValue(true);
    const res = await deleteCustomerById(
      new Request("http://localhost/api/customers/c-1", { method: "DELETE" }),
      makeParams("c-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; message: string };
    expect(body.id).toBe("c-1");
    expect(typeof body.message).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// GET /api/customers/[id]/properties
// ---------------------------------------------------------------------------

describe("GET /api/customers/[id]/properties — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getCustomerProperties(
      new Request("http://localhost/api/customers/c-1/properties"),
      makeParams("c-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getCustomerProperties(
      new Request("http://localhost/api/customers/c-1/properties"),
      makeParams("c-1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with properties array for an authorized request", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    listPropertiesForCustomerMock.mockResolvedValue([{ id: "p-1" }]);
    const res = await getCustomerProperties(
      new Request("http://localhost/api/customers/c-1/properties"),
      makeParams("c-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { properties: Array<{ id: string }> };
    expect(Array.isArray(body.properties)).toBe(true);
    expect(body.properties[0].id).toBe("p-1");
  });
});

// ---------------------------------------------------------------------------
// GET /api/customers/[id]/jobs
// ---------------------------------------------------------------------------

describe("GET /api/customers/[id]/jobs — contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());
    const res = await getCustomerJobs(
      new Request("http://localhost/api/customers/c-1/jobs"),
      makeParams("c-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a disallowed role", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenResponse());
    const res = await getCustomerJobs(
      new Request("http://localhost/api/customers/c-1/jobs"),
      makeParams("c-1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with jobs array for an authorized request", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    listJobsForCustomerMock.mockResolvedValue([{ id: "j-1" }]);
    const res = await getCustomerJobs(
      new Request("http://localhost/api/customers/c-1/jobs"),
      makeParams("c-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { jobs: Array<{ id: string }> };
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(body.jobs[0].id).toBe("j-1");
  });
});
