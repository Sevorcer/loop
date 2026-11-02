import { beforeEach, describe, expect, it, vi } from "vitest";

// The route pulls in server-only modules; stub the guard and the service
// boundary, mirroring jobs-route-regression.test.ts.
vi.mock("server-only", () => ({}));

const { requirePermissionMock, listJobsForCalendarMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  listJobsForCalendarMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/services/jobs", () => ({
  listJobsForCalendar: listJobsForCalendarMock,
}));

function request(query: string) {
  return new Request(`http://localhost/api/calendar/jobs${query}`);
}

describe("GET /api/calendar/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { userId: "user-owner-1", role: "owner" },
    });
    listJobsForCalendarMock.mockResolvedValue({ jobs: [], unscheduledCount: 0 });
  });

  it("returns the range jobs and unscheduled count for a valid range", async () => {
    listJobsForCalendarMock.mockResolvedValue({
      jobs: [{ id: "job-1" }],
      unscheduledCount: 3,
    });

    const { GET } = await import("@/app/api/calendar/jobs/route");
    const response = await GET(request("?from=2026-11-01&to=2026-11-30"));

    expect(response.status).toBe(200);
    expect(listJobsForCalendarMock).toHaveBeenCalledWith("2026-11-01", "2026-11-30");
    await expect(response.json()).resolves.toEqual({
      jobs: [{ id: "job-1" }],
      unscheduledCount: 3,
    });
  });

  it("checks the jobs select permission before reading", async () => {
    const { GET } = await import("@/app/api/calendar/jobs/route");
    await GET(request("?from=2026-11-01&to=2026-11-30"));
    expect(requirePermissionMock).toHaveBeenCalledWith(expect.anything(), "jobs", "select");
  });

  it("rejects missing parameters with 400 and never reads jobs", async () => {
    const { GET } = await import("@/app/api/calendar/jobs/route");

    for (const query of ["", "?from=2026-11-01", "?to=2026-11-30"]) {
      const response = await GET(request(query));
      expect(response.status).toBe(400);
    }
    expect(listJobsForCalendarMock).not.toHaveBeenCalled();
  });

  it("rejects malformed and impossible dates with 400", async () => {
    const { GET } = await import("@/app/api/calendar/jobs/route");

    for (const query of [
      "?from=11/01/2026&to=2026-11-30",
      "?from=2026-11-01&to=2026-11-31",
      "?from=2026-02-01&to=2026-02-29",
      "?from=2026-11-01T00:00:00Z&to=2026-11-30",
    ]) {
      const response = await GET(request(query));
      expect(response.status).toBe(400);
    }
    expect(listJobsForCalendarMock).not.toHaveBeenCalled();
  });

  it("rejects a reversed or over-wide range with 400", async () => {
    const { GET } = await import("@/app/api/calendar/jobs/route");

    expect((await GET(request("?from=2026-11-30&to=2026-11-01"))).status).toBe(400);
    expect((await GET(request("?from=2025-01-01&to=2026-12-31"))).status).toBe(400);
    expect(listJobsForCalendarMock).not.toHaveBeenCalled();
  });

  it("passes a denied permission straight through", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 }),
    });

    const { GET } = await import("@/app/api/calendar/jobs/route");
    const response = await GET(request("?from=2026-11-01&to=2026-11-30"));

    expect(response.status).toBe(403);
    expect(listJobsForCalendarMock).not.toHaveBeenCalled();
  });
});
