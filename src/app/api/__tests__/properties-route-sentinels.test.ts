import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("properties route sentinel logs", () => {
  let consoleInfoMock: ReturnType<typeof vi.spyOn>;
  const originalCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  const originalUrl = process.env.VERCEL_URL;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    consoleInfoMock = vi.spyOn(console, "info").mockImplementation(() => {});
    process.env.VERCEL_GIT_COMMIT_SHA = "commit-sha";
    process.env.VERCEL_URL = "loop.vercel.app";
  });

  afterEach(() => {
    consoleInfoMock.mockRestore();

    if (originalCommit === undefined) {
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    } else {
      process.env.VERCEL_GIT_COMMIT_SHA = originalCommit;
    }

    if (originalUrl === undefined) {
      delete process.env.VERCEL_URL;
    } else {
      process.env.VERCEL_URL = originalUrl;
    }
  });

  it("logs module load metadata when the route module is imported", async () => {
    await import("@/app/api/properties/route");

    expect(consoleInfoMock).toHaveBeenCalledWith("API_ROUTE_MODULE_LOADED", {
      route: "/api/properties",
      commit: "commit-sha",
      url: "loop.vercel.app",
    });
  });

  it("logs POST start before later handler checkpoints", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { userId: "user-1", role: "owner" },
    });
    readJsonObjectMock.mockResolvedValue({
      name: "Smoke Test Property",
      customer: "Acme",
      address: "123 Main St",
      city: "Calgary",
      type: "Residential",
      status: "Active",
      primarySystem: "Furnace",
    });
    createPropertyMock.mockResolvedValue({
      property: { id: "property-1" },
      geocodeStatus: "skipped",
    });

    const { POST } = await import("@/app/api/properties/route");
    consoleInfoMock.mockClear();

    const response = await POST(
      new Request("http://localhost/api/properties", {
        method: "POST",
        headers: { "x-request-id": "req-prop-1" },
      }),
    );

    expect(response.status).toBe(201);
    expect(consoleInfoMock.mock.calls[0]).toEqual([
      "API_ROUTE_POST_START",
      { route: "/api/properties" },
    ]);
    expect(consoleInfoMock).toHaveBeenCalledWith(
      "API_POST_CHECKPOINT",
      expect.objectContaining({
        route: "/api/properties",
        step: "before_insert",
        requestId: "req-prop-1",
      }),
    );
  });
});
