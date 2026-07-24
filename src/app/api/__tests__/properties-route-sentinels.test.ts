import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Route modules import @/lib/supabase/server which uses the server-only guard.
// Mock both the guard module and the server client before any route imports.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

const {
  requirePermissionMock,
  readJsonObjectMock,
  createPropertyMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  readJsonObjectMock: vi.fn(),
  createPropertyMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/api/routeErrors", () => ({
  readJsonObject: readJsonObjectMock,
  invalidJsonResponse: vi.fn(() => new Response(JSON.stringify({ error: "INVALID_PAYLOAD" }), { status: 400 })),
  mapRouteError: vi.fn((error: unknown) =>
    new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
  ),
}));

vi.mock("@/lib/audit", () => ({
  emitAuditEvent: vi.fn(),
}));

vi.mock("@/services/properties", () => ({
  createProperty: createPropertyMock,
  listProperties: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Shared test body for a valid property creation request
// ---------------------------------------------------------------------------

function validPropertyBody() {
  return {
    name: "Smoke Test Property",
    customer: "Acme",
    address: "123 Main St",
    city: "Calgary",
    type: "Residential",
    status: "Active",
    primarySystem: "Furnace",
  };
}

// ---------------------------------------------------------------------------
// Module-load sentinel — API_ROUTE_MODULE_LOADED must NOT be emitted
// ---------------------------------------------------------------------------

describe("properties route module-load sentinel", () => {
  let consoleInfoMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    consoleInfoMock = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoMock.mockRestore();
  });

  it("does not emit API_ROUTE_MODULE_LOADED on import", async () => {
    await import("@/app/api/properties/route");

    expect(consoleInfoMock).not.toHaveBeenCalledWith(
      "API_ROUTE_MODULE_LOADED",
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/properties — owner happy path
// ---------------------------------------------------------------------------

describe("POST /api/properties — owner happy path", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 and calls createProperty for an authenticated owner", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { userId: "user-owner-1", role: "owner" },
    });
    readJsonObjectMock.mockResolvedValue(validPropertyBody());
    createPropertyMock.mockResolvedValue({
      property: { id: "property-1" },
      geocodeStatus: "skipped",
    });

    const { POST } = await import("@/app/api/properties/route");
    const response = await POST(
      new Request("http://localhost/api/properties", {
        method: "POST",
        headers: { "x-request-id": "req-owner-1" },
      }),
    );

    expect(response.status).toBe(201);
    expect(createPropertyMock).toHaveBeenCalledOnce();

    const body = await response.json() as { property: { id: string } };
    expect(body.property.id).toBe("property-1");
  });
});

// ---------------------------------------------------------------------------
// POST /api/properties — authorization guard blocks disallowed roles
// ---------------------------------------------------------------------------

describe("POST /api/properties — authorization guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 403 for a disallowed role and does not call createProperty", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "FORBIDDEN", message: "Role 'viewer' is not permitted.", code: 403 }),
        { status: 403 },
      ),
    });

    const { POST } = await import("@/app/api/properties/route");
    const response = await POST(
      new Request("http://localhost/api/properties", { method: "POST" }),
    );

    expect(response.status).toBe(403);
    expect(readJsonObjectMock).not.toHaveBeenCalled();
    expect(createPropertyMock).not.toHaveBeenCalled();
  });

  it("returns 401 for missing auth context and does not call createProperty", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "UNAUTHORIZED", message: "A valid session is required.", code: 401 }),
        { status: 401 },
      ),
    });

    const { POST } = await import("@/app/api/properties/route");
    const response = await POST(
      new Request("http://localhost/api/properties", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(readJsonObjectMock).not.toHaveBeenCalled();
    expect(createPropertyMock).not.toHaveBeenCalled();
  });
});
