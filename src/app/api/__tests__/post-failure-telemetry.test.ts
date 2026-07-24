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
  mapRouteErrorMock,
  createPropertyMock,
  createJobMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  readJsonObjectMock: vi.fn(),
  mapRouteErrorMock: vi.fn(),
  createPropertyMock: vi.fn(),
  createJobMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/api/routeErrors", () => ({
  readJsonObject: readJsonObjectMock,
  invalidJsonResponse: vi.fn(() => new Response(JSON.stringify({ error: "INVALID_PAYLOAD" }), { status: 400 })),
  mapRouteError: mapRouteErrorMock,
}));

vi.mock("@/lib/audit", () => ({
  emitAuditEvent: vi.fn(),
}));

vi.mock("@/services/properties", () => ({
  createProperty: createPropertyMock,
  listProperties: vi.fn(),
}));

vi.mock("@/services/jobs", () => ({
  createJob: createJobMock,
  listJobsWithActivity: vi.fn(),
}));

import { POST as postJobs } from "@/app/api/jobs/route";
import { POST as postProperties } from "@/app/api/properties/route";

describe("POST route failure telemetry — API_POST_FAILURE is emitted on write errors", () => {
  let consoleErrorMock: ReturnType<typeof vi.spyOn>;
  let consoleInfoMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleInfoMock = vi.spyOn(console, "info").mockImplementation(() => {});

    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { userId: "user-1", role: "owner" },
    });

    mapRouteErrorMock.mockImplementation(() =>
      new Response(JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }), { status: 500 }),
    );
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
    consoleInfoMock.mockRestore();
  });

  it("emits API_POST_FAILURE with structured telemetry for POST /api/properties", async () => {
    readJsonObjectMock.mockResolvedValue({
      name: "Smoke Test Property",
      customer: "Acme",
      address: "123 Main St",
      city: "Calgary",
      type: "Residential",
      status: "Active",
      primarySystem: "Furnace",
    });

    createPropertyMock.mockRejectedValue(
      Object.assign(new Error("insert failed"), {
        code: "23505",
        details: "duplicate key",
        hint: "check unique index",
        status: 500,
      }),
    );

    const response = await postProperties(
      new Request("http://localhost/api/properties", {
        method: "POST",
        headers: { "x-request-id": "req-prop-1" },
      }),
    );

    expect(response.status).toBe(500);
    expect(consoleInfoMock).not.toHaveBeenCalledWith(
      "API_ROUTE_POST_START",
      expect.anything(),
    );
    expect(consoleInfoMock).not.toHaveBeenCalledWith(
      "API_ROUTE_TRY_ENTER",
      expect.anything(),
    );
    expect(consoleInfoMock).not.toHaveBeenCalledWith(
      "API_POST_CHECKPOINT",
      expect.anything(),
    );
    expect(consoleErrorMock).toHaveBeenCalledWith(
      "API_POST_FAILURE",
      expect.objectContaining({
        route: "/api/properties",
        requestId: "req-prop-1",
        step: "create_property_service",
        name: "Error",
        message: "insert failed",
        stack: expect.any(String),
        code: "23505",
        details: "duplicate key",
        hint: "check unique index",
        status: 500,
      }),
    );
  });

  it("emits API_POST_FAILURE with structured telemetry for POST /api/jobs", async () => {
    readJsonObjectMock.mockResolvedValue({
      title: "Install Heat Pump",
      customerName: "Acme",
      propertyName: "Smoke Test Property",
      assignedTo: "Tech One",
      scheduledFor: "2026-07-24",
      type: "Install",
      priority: "High",
    });

    createJobMock.mockRejectedValue(
      Object.assign(new Error("jobs insert failed"), {
        code: "PGRST301",
        details: "db details",
        hint: "db hint",
        status: 500,
      }),
    );

    const response = await postJobs(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        headers: { "x-request-id": "req-job-1" },
      }),
    );

    expect(response.status).toBe(500);
    expect(consoleInfoMock).not.toHaveBeenCalledWith(
      "API_ROUTE_POST_START",
      expect.anything(),
    );
    expect(consoleInfoMock).not.toHaveBeenCalledWith(
      "API_ROUTE_TRY_ENTER",
      expect.anything(),
    );
    expect(consoleInfoMock).not.toHaveBeenCalledWith(
      "API_POST_CHECKPOINT",
      expect.anything(),
    );
    expect(consoleErrorMock).toHaveBeenCalledWith(
      "API_POST_FAILURE",
      expect.objectContaining({
        route: "/api/jobs",
        requestId: "req-job-1",
        step: "create_job_service",
        name: "Error",
        message: "jobs insert failed",
        stack: expect.any(String),
        code: "PGRST301",
        details: "db details",
        hint: "db hint",
        status: 500,
      }),
    );
  });
});

