/**
 * DELETE /api/jobs/[id]/signature/[signatureId] — org-scoping contract test.
 *
 * Validates that:
 *   - 401 when unauthenticated
 *   - 403 when role is not permitted (e.g. tech)
 *   - 404 when signature belongs to a different org (cross-org delete refused)
 *   - 200 on the happy path (same-org delete)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, deleteJobSignatureMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  deleteJobSignatureMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/lib/api/routeErrors", () => ({
  mapRouteError: vi.fn((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }),
  createApiErrorResponse: vi.fn((code: string, message: string, status: number) =>
    new Response(JSON.stringify({ error: code, message }), { status }),
  ),
}));

vi.mock("@/services/jobSignatures", () => ({
  deleteJobSignature: deleteJobSignatureMock,
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function authedGuard(role: string) {
  return {
    ok: true,
    ctx: { role, userId: "user-001" },
  };
}

function unauthGuard() {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 }),
  };
}

function forbiddenGuard() {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 }),
  };
}

function makeRequest() {
  return new Request("http://localhost/api/jobs/job-1/signature/sig-1", { method: "DELETE" });
}

function routeContext(jobId = "job-1", signatureId = "sig-1") {
  return { params: Promise.resolve({ id: jobId, signatureId }) };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("DELETE /api/jobs/[id]/signature/[signatureId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthGuard());

    const { DELETE } = await import(
      "@/app/api/jobs/[id]/signature/[signatureId]/route"
    );

    const res = await DELETE(makeRequest(), routeContext());
    expect(res.status).toBe(401);
  });

  it("returns 403 when role lacks delete permission (e.g. tech)", async () => {
    requirePermissionMock.mockResolvedValue(forbiddenGuard());

    const { DELETE } = await import(
      "@/app/api/jobs/[id]/signature/[signatureId]/route"
    );

    const res = await DELETE(makeRequest(), routeContext());
    expect(res.status).toBe(403);
  });

  it("returns 404 when signature not found (cross-org delete refused)", async () => {
    requirePermissionMock.mockResolvedValue(authedGuard("owner"));
    // Service returns false — signature either doesn't exist or belongs to another org
    deleteJobSignatureMock.mockResolvedValue(false);

    const { DELETE } = await import(
      "@/app/api/jobs/[id]/signature/[signatureId]/route"
    );

    const res = await DELETE(makeRequest(), routeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns 200 with deleted:true on successful same-org delete", async () => {
    requirePermissionMock.mockResolvedValue(authedGuard("owner"));
    deleteJobSignatureMock.mockResolvedValue(true);

    const { DELETE } = await import(
      "@/app/api/jobs/[id]/signature/[signatureId]/route"
    );

    const res = await DELETE(makeRequest(), routeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(deleteJobSignatureMock).toHaveBeenCalledWith("sig-1", "job-1");
  });

  it("passes correct table and action to requirePermission", async () => {
    requirePermissionMock.mockResolvedValue(authedGuard("manager"));
    deleteJobSignatureMock.mockResolvedValue(true);

    const { DELETE } = await import(
      "@/app/api/jobs/[id]/signature/[signatureId]/route"
    );

    await DELETE(makeRequest(), routeContext());
    expect(requirePermissionMock).toHaveBeenCalledWith(
      expect.any(Request),
      "job_signatures",
      "delete",
    );
  });
});
