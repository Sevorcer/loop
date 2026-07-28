/**
 * Feedback API contract tests — Sprint 7 Mini-Epic
 *
 * Covered routes:
 *   POST  /api/feedback         — create feedback (all operational staff)
 *   GET   /api/feedback         — list feedback (manager/owner only)
 *   PATCH /api/feedback/[id]    — triage update (manager/owner only)
 *
 * Each route validated for:
 *   - 401 when unauthenticated
 *   - 403 when role is not permitted
 *   - 201/200 on the happy path (correct shape)
 *   - 400 for validation failures
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  readJsonObjectMock,
  createFeedbackReportMock,
  listFeedbackReportsMock,
  updateFeedbackReportMock,
  logWriteFailureMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  readJsonObjectMock: vi.fn(),
  createFeedbackReportMock: vi.fn(),
  listFeedbackReportsMock: vi.fn(),
  updateFeedbackReportMock: vi.fn(),
  logWriteFailureMock: vi.fn(),
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
  mapRouteError: vi.fn((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    const status = msg.toLowerCase().includes("required") || msg.toLowerCase().includes("invalid") ? 400 : 500;
    return new Response(JSON.stringify({ error: msg }), { status });
  }),
  createApiErrorResponse: vi.fn((code: string, message: string, status: number) =>
    new Response(JSON.stringify({ error: code, message }), { status }),
  ),
}));

vi.mock("@/services/feedbackReports", () => ({
  createFeedbackReport: createFeedbackReportMock,
  listFeedbackReports: listFeedbackReportsMock,
  updateFeedbackReport: updateFeedbackReportMock,
}));

vi.mock("@/repositories/storage", () => ({
  uploadFile: vi.fn(),
}));

vi.mock("@/lib/observability/writes", () => ({
  logWriteFailure: logWriteFailureMock,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockReport = {
  id: "fb-001",
  orgId: "org-001",
  createdAt: "2026-07-28T00:00:00Z",
  createdByUserId: "user-001",
  createdByRole: "tech",
  severity: "P1",
  intendedAction: "Assign crew to job",
  actualResult: "Error on submit",
  routePath: "/dispatch",
  contextJobId: null,
  contextCustomerId: null,
  contextPropertyId: null,
  screenshotUrl: null,
  status: "new",
  triageNotes: null,
};

function makeRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Request {
  const body = options.body ? JSON.stringify(options.body) : undefined;
  return new Request(url, {
    method: options.method ?? "GET",
    body,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

function unauthorizedResult() {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 }),
  };
}

function forbiddenResult() {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 }),
  };
}

function authorizedResult(role = "tech") {
  return {
    ok: true as const,
    ctx: { role, userId: "user-001" },
  };
}

// ─── POST /api/feedback ───────────────────────────────────────────────────────

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValueOnce(unauthorizedResult());

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("http://localhost/api/feedback", {
        method: "POST",
        body: { severity: "P1", intendedAction: "Test", actualResult: "Error", routePath: "/dispatch" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not permitted (portal)", async () => {
    requirePermissionMock.mockResolvedValueOnce(forbiddenResult());

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("http://localhost/api/feedback", {
        method: "POST",
        body: { severity: "P1", intendedAction: "Test", actualResult: "Error", routePath: "/" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 201 with report id on success (JSON)", async () => {
    requirePermissionMock.mockResolvedValueOnce(authorizedResult("tech"));
    createFeedbackReportMock.mockResolvedValueOnce(mockReport);

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("http://localhost/api/feedback", {
        method: "POST",
        body: {
          severity: "P1",
          intendedAction: "Assign crew",
          actualResult: "Error on submit",
          routePath: "/dispatch",
        },
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json() as { report: { id: string } };
    expect(body.report.id).toBe("fb-001");
  });

  it("returns 400 when validation fails (service throws)", async () => {
    requirePermissionMock.mockResolvedValueOnce(authorizedResult("tech"));
    createFeedbackReportMock.mockRejectedValueOnce(
      new Error("What you were trying to do is required."),
    );

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("http://localhost/api/feedback", {
        method: "POST",
        body: { severity: "P1", intendedAction: "", actualResult: "Error", routePath: "/dispatch" },
      }),
    );

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/feedback ────────────────────────────────────────────────────────

describe("GET /api/feedback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValueOnce(unauthorizedResult());

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/feedback"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-manager role (tech)", async () => {
    requirePermissionMock.mockResolvedValueOnce(forbiddenResult());

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/feedback"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with reports array for manager", async () => {
    requirePermissionMock.mockResolvedValueOnce(authorizedResult("manager"));
    listFeedbackReportsMock.mockResolvedValueOnce([mockReport]);

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("http://localhost/api/feedback?severity=P1"),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { reports: typeof mockReport[] };
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0].id).toBe("fb-001");
  });
});

// ─── PATCH /api/feedback/[id] ─────────────────────────────────────────────────

describe("PATCH /api/feedback/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValueOnce(unauthorizedResult());

    const { PATCH } = await import("../[id]/route");
    const res = await PATCH(
      makeRequest("http://localhost/api/feedback/fb-001", { method: "PATCH", body: { status: "triaged" } }),
      { params: Promise.resolve({ id: "fb-001" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-manager role", async () => {
    requirePermissionMock.mockResolvedValueOnce(forbiddenResult());

    const { PATCH } = await import("../[id]/route");
    const res = await PATCH(
      makeRequest("http://localhost/api/feedback/fb-001", { method: "PATCH", body: { status: "triaged" } }),
      { params: Promise.resolve({ id: "fb-001" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with updated report for manager", async () => {
    requirePermissionMock.mockResolvedValueOnce(authorizedResult("manager"));
    readJsonObjectMock.mockResolvedValueOnce({ status: "triaged", triageNotes: "Confirmed, low priority." });
    updateFeedbackReportMock.mockResolvedValueOnce({ ...mockReport, status: "triaged", triageNotes: "Confirmed, low priority." });

    const { PATCH } = await import("../[id]/route");
    const res = await PATCH(
      makeRequest("http://localhost/api/feedback/fb-001", {
        method: "PATCH",
        body: { status: "triaged", triageNotes: "Confirmed, low priority." },
      }),
      { params: Promise.resolve({ id: "fb-001" }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { report: { status: string; triageNotes: string } };
    expect(body.report.status).toBe("triaged");
    expect(body.report.triageNotes).toBe("Confirmed, low priority.");
  });
});
