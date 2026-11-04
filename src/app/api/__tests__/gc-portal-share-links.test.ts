/**
 * GC Portal — Share Link Tests (Task 1)
 *
 * Tests:
 * - Valid token resolves to its job
 * - Revoked token returns 404
 * - Token A cannot access job B
 * - Share link creation returns token
 * - Share link revocation
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  requirePermissionMock,
  resolveShareTokenMock,
  getPortalJobDataMock,
  createJobShareLinkMock,
  revokeJobShareLinkMock,
  getActiveShareLinkMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  resolveShareTokenMock: vi.fn(),
  getPortalJobDataMock: vi.fn(),
  createJobShareLinkMock: vi.fn(),
  revokeJobShareLinkMock: vi.fn(),
  getActiveShareLinkMock: vi.fn(),
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
}));

vi.mock("@/services/jobShareLinks", () => ({
  resolveShareToken: resolveShareTokenMock,
  createJobShareLink: createJobShareLinkMock,
  revokeJobShareLink: revokeJobShareLinkMock,
  getActiveShareLink: getActiveShareLinkMock,
}));

vi.mock("@/services/portalJobData", () => ({
  getPortalJobData: getPortalJobDataMock,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = "a".repeat(64);
const REVOKED_TOKEN = "b".repeat(64);
const JOB_A_ID = "job-aaa-111";
const JOB_B_ID = "job-bbb-222";
const ORG_ID = "org-001";

const JOB_A_DATA = {
  id: JOB_A_ID,
  jobNumber: "J-100",
  status: "In Progress",
  type: "Install",
  scheduledDate: "2026-11-10",
  completedDate: null,
  propertyAddress: "123 Main St",
  customerName: "Test Customer",
  crewFirstNames: ["Alex"],
  timeline: [],
  photos: [],
  documents: [],
};

function mockRequest(url: string, method = "GET") {
  return new Request(url, { method });
}

function officeCtx() {
  return {
    ok: true as const,
    ctx: { role: "office" as const, userId: "user-001" },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/portal/[token] — public token resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns job data for a valid token", async () => {
    resolveShareTokenMock.mockResolvedValue({ id: "link-1", orgId: ORG_ID, jobId: JOB_A_ID });
    getPortalJobDataMock.mockResolvedValue(JOB_A_DATA);

    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(
      mockRequest(`http://localhost/api/portal/${VALID_TOKEN}`),
      { params: Promise.resolve({ token: VALID_TOKEN }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job.id).toBe(JOB_A_ID);
    expect(body.job.jobNumber).toBe("J-100");
  });

  it("returns 404 for a revoked token", async () => {
    resolveShareTokenMock.mockResolvedValue(null);

    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(
      mockRequest(`http://localhost/api/portal/${REVOKED_TOKEN}`),
      { params: Promise.resolve({ token: REVOKED_TOKEN }) },
    );

    expect(res.status).toBe(404);
  });

  it("token A cannot access job B — scoped to resolved job only", async () => {
    // Token A resolves to Job A
    resolveShareTokenMock.mockResolvedValue({ id: "link-1", orgId: ORG_ID, jobId: JOB_A_ID });
    getPortalJobDataMock.mockResolvedValue(JOB_A_DATA);

    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(
      mockRequest(`http://localhost/api/portal/${VALID_TOKEN}`),
      { params: Promise.resolve({ token: VALID_TOKEN }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    // The response is for job A, not job B
    expect(body.job.id).toBe(JOB_A_ID);
    expect(body.job.id).not.toBe(JOB_B_ID);

    // Verify resolveShareToken was called with the token (it determines the job scope)
    expect(resolveShareTokenMock).toHaveBeenCalledWith(VALID_TOKEN);

    // Verify getPortalJobData was called with the resolved job ID, not any URL parameter
    expect(getPortalJobDataMock).toHaveBeenCalledWith(JOB_A_ID, ORG_ID);
  });
});

describe("POST /api/jobs/[id]/share-link — create share link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a share link and returns the token (201)", async () => {
    requirePermissionMock.mockResolvedValue(officeCtx());
    createJobShareLinkMock.mockResolvedValue({
      link: {
        id: "link-new",
        orgId: ORG_ID,
        jobId: JOB_A_ID,
        createdBy: "user-001",
        createdAt: "2026-11-04T00:00:00Z",
        revokedAt: null,
      },
      token: VALID_TOKEN,
    });

    const { POST } = await import("@/app/api/jobs/[id]/share-link/route");
    const res = await POST(
      mockRequest(`http://localhost/api/jobs/${JOB_A_ID}/share-link`, "POST"),
      { params: Promise.resolve({ id: JOB_A_ID }) },
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBe(VALID_TOKEN);
    expect(body.shareLink.jobId).toBe(JOB_A_ID);
  });

  it("rejects non-office roles with 403", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { role: "tech", userId: "user-tech" },
    });

    const { POST } = await import("@/app/api/jobs/[id]/share-link/route");
    const res = await POST(
      mockRequest(`http://localhost/api/jobs/${JOB_A_ID}/share-link`, "POST"),
      { params: Promise.resolve({ id: JOB_A_ID }) },
    );

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/jobs/[id]/share-link — revoke share link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes the active share link", async () => {
    requirePermissionMock.mockResolvedValue(officeCtx());
    revokeJobShareLinkMock.mockResolvedValue(undefined);

    const { DELETE } = await import("@/app/api/jobs/[id]/share-link/route");
    const res = await DELETE(
      mockRequest(`http://localhost/api/jobs/${JOB_A_ID}/share-link`, "DELETE"),
      { params: Promise.resolve({ id: JOB_A_ID }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
