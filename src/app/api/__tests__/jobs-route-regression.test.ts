import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// Route modules import @/lib/supabase/server which uses the server-only guard.
// Mock both the guard module and the server client before any route imports.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

const {
  requirePermissionMock,
  readJsonObjectMock,
  createJobMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  readJsonObjectMock: vi.fn(),
  createJobMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/api/routeErrors", () => ({
  readJsonObject: readJsonObjectMock,
  invalidJsonResponse: vi.fn(() =>
    new Response(JSON.stringify({ error: "INVALID_PAYLOAD" }), { status: 400 }),
  ),
  mapRouteError: vi.fn((error: unknown) =>
    new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
  ),
}));

vi.mock("@/lib/audit", () => ({
  emitAuditEvent: vi.fn(),
}));

vi.mock("@/services/jobs", () => ({
  createJob: createJobMock,
  listJobsWithActivity: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Shared test body for a valid job creation request
// ---------------------------------------------------------------------------

function validJobBody() {
  return {
    title: "Install HVAC System",
    customerName: "Acme Corp",
    propertyName: "Acme HQ",
    assignedTo: "Tech Team",
    scheduledFor: "2026-08-01",
    type: "Install",
    priority: "High",
    location: "123 Main St",
    summary: "Full install",
    notes: "",
  };
}

// ---------------------------------------------------------------------------
// POST /api/jobs — owner happy path
// ---------------------------------------------------------------------------

describe("POST /api/jobs — owner happy path", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 and calls createJob for an authenticated owner", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { userId: "user-owner-1", role: "owner" },
    });
    readJsonObjectMock.mockResolvedValue(validJobBody());
    createJobMock.mockResolvedValue({
      id: "job-1",
      title: "Install HVAC System",
      type: "Install",
    });

    const { POST } = await import("@/app/api/jobs/route");
    const response = await POST(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        headers: { "x-request-id": "req-owner-job-1" },
      }),
    );

    expect(response.status).toBe(201);
    expect(createJobMock).toHaveBeenCalledOnce();

    const body = await response.json() as { job: { id: string } };
    expect(body.job.id).toBe("job-1");
  });
});

// ---------------------------------------------------------------------------
// POST /api/jobs — authorization guard blocks disallowed roles and missing auth
// ---------------------------------------------------------------------------

describe("POST /api/jobs — authorization guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 403 for a disallowed role and does not call createJob", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "FORBIDDEN", message: "Role 'viewer' is not permitted.", code: 403 }),
        { status: 403 },
      ),
    });

    const { POST } = await import("@/app/api/jobs/route");
    const response = await POST(
      new Request("http://localhost/api/jobs", { method: "POST" }),
    );

    expect(response.status).toBe(403);
    expect(readJsonObjectMock).not.toHaveBeenCalled();
    expect(createJobMock).not.toHaveBeenCalled();
  });

  it("returns 401 for missing auth context and does not call createJob", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "UNAUTHORIZED", message: "A valid session is required.", code: 401 }),
        { status: 401 },
      ),
    });

    const { POST } = await import("@/app/api/jobs/route");
    const response = await POST(
      new Request("http://localhost/api/jobs", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(readJsonObjectMock).not.toHaveBeenCalled();
    expect(createJobMock).not.toHaveBeenCalled();
  });
});
