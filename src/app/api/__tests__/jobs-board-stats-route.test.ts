import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, getJobBoardStatsMock, listJobsWithActivityMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getJobBoardStatsMock: vi.fn(),
  listJobsWithActivityMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});
vi.mock("@/lib/audit", () => ({ emitAuditEvent: vi.fn() }));
vi.mock("@/services/jobs", () => ({
  createJob: vi.fn(),
  getJobBoardStats: getJobBoardStatsMock,
  listJobsWithActivity: listJobsWithActivityMock,
  listJobsPage: vi.fn(),
}));

import { GET } from "@/app/api/jobs/route";

describe("GET /api/jobs?view=stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ ok: true, ctx: { userId: "u1", role: "owner" } });
  });

  it("returns database counts without loading the full job workspace", async () => {
    getJobBoardStatsMock.mockResolvedValue({ total: 3717, inProgress: 6, scheduled: 62, highPriority: 1 });

    const response = await GET(new Request("http://localhost/api/jobs?view=stats"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      stats: { total: 3717, inProgress: 6, scheduled: 62, highPriority: 1 },
    });
    expect(listJobsWithActivityMock).not.toHaveBeenCalled();
  });

  it("is permission-guarded like the rest of /api/jobs", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 }),
    });

    const response = await GET(new Request("http://localhost/api/jobs?view=stats"));

    expect(response.status).toBe(403);
    expect(getJobBoardStatsMock).not.toHaveBeenCalled();
  });
});
