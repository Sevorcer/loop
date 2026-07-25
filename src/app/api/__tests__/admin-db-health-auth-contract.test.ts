import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  listHealthRunsMock,
  getHealthRunMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  listHealthRunsMock: vi.fn(),
  getHealthRunMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/services/dbHealth", () => ({
  listHealthRuns: listHealthRunsMock,
  getHealthRun: getHealthRunMock,
}));

import { GET as getRuns } from "@/app/api/admin/db-health/runs/route";
import { GET as getRunById } from "@/app/api/admin/db-health/runs/[id]/route";

describe("admin DB health auth contract regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the shared 401 auth contract for the runs endpoint", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({
          error: "UNAUTHORIZED",
          message: "Your session has expired. Please sign in again.",
          code: 401,
          reason: "expired_token",
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    });

    const response = await getRuns(new Request("http://localhost/api/admin/db-health/runs"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      error: "UNAUTHORIZED",
      code: 401,
      reason: "expired_token",
    });
  });

  it("preserves the shared 403 auth contract for the run detail endpoint", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({
          error: "FORBIDDEN",
          message: "Role 'office' is not permitted to perform 'select' on 'db_health_check_runs'.",
          code: 403,
          reason: "insufficient_permission",
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    });

    const response = await getRunById(
      new Request("http://localhost/api/admin/db-health/runs/run-1"),
      { params: Promise.resolve({ id: "run-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      error: "FORBIDDEN",
      code: 403,
      reason: "insufficient_permission",
    });
  });
});
