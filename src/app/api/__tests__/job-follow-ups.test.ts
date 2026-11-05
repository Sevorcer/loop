import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, getFollowUpMock, setFollowUpMock, listFollowUpsMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getFollowUpMock: vi.fn(),
  setFollowUpMock: vi.fn(),
  listFollowUpsMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/services/jobFollowUps", () => ({
  getFollowUp: getFollowUpMock,
  setFollowUp: setFollowUpMock,
  listFollowUps: listFollowUpsMock,
}));

import { GET as listGET } from "@/app/api/follow-ups/route";
import { GET, PUT } from "@/app/api/jobs/[id]/follow-up/route";

const params = Promise.resolve({ id: "job-1" });
const ok = (role: string) => ({ ok: true as const, ctx: { userId: "user-1", role } });
const denied = () => ({
  ok: false as const,
  response: new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 }),
});
const put = (body: unknown) =>
  new Request("http://localhost/api/jobs/job-1/follow-up", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => vi.resetAllMocks());

describe("PUT /api/jobs/[id]/follow-up", () => {
  it("marks a job and stamps the signed-in user", async () => {
    requirePermissionMock.mockResolvedValue(ok("office"));
    setFollowUpMock.mockResolvedValue({ needed: true, note: "blower motor on order", markedAt: "2026-11-05T18:00:00Z", markedBy: "user-1" });

    const res = await PUT(put({ needed: true, note: "blower motor on order" }), { params });

    expect(res.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(expect.anything(), "jobs", "update");
    expect(setFollowUpMock).toHaveBeenCalledWith({
      jobId: "job-1",
      needed: true,
      note: "blower motor on order",
      userId: "user-1",
    });
  });

  it("unmarks a job", async () => {
    requirePermissionMock.mockResolvedValue(ok("tech"));
    setFollowUpMock.mockResolvedValue({ needed: false, note: null, markedAt: null, markedBy: null });

    const res = await PUT(put({ needed: false }), { params });

    expect(res.status).toBe(200);
    expect((await res.json()).followUp.needed).toBe(false);
  });

  it("rejects a body without a boolean needed", async () => {
    requirePermissionMock.mockResolvedValue(ok("office"));
    const res = await PUT(put({ needed: "yes" }), { params });
    expect(res.status).toBe(400);
    expect(setFollowUpMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the permission guard denies", async () => {
    requirePermissionMock.mockResolvedValue(denied());
    const res = await PUT(put({ needed: true }), { params });
    expect(res.status).toBe(403);
    expect(setFollowUpMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the job is missing or not visible", async () => {
    requirePermissionMock.mockResolvedValue(ok("office"));
    setFollowUpMock.mockRejectedValue(new Error("Job not found."));
    const res = await PUT(put({ needed: true }), { params });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/jobs/[id]/follow-up", () => {
  it("returns the follow-up state", async () => {
    requirePermissionMock.mockResolvedValue(ok("office"));
    getFollowUpMock.mockResolvedValue({ needed: true, note: null, markedAt: null, markedBy: null });
    const res = await GET(new Request("http://localhost/api/jobs/job-1/follow-up"), { params });
    expect(res.status).toBe(200);
    expect((await res.json()).followUp.needed).toBe(true);
  });

  it("returns 404 for an unknown job", async () => {
    requirePermissionMock.mockResolvedValue(ok("office"));
    getFollowUpMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/jobs/job-1/follow-up"), { params });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/follow-ups", () => {
  it("lists open follow-ups with a total", async () => {
    requirePermissionMock.mockResolvedValue(ok("dispatch"));
    listFollowUpsMock.mockResolvedValue([{ jobId: "job-1" }, { jobId: "job-2" }]);
    const res = await listGET(new Request("http://localhost/api/follow-ups"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(2);
    expect(requirePermissionMock).toHaveBeenCalledWith(expect.anything(), "jobs", "select");
  });

  it("returns 403 when denied", async () => {
    requirePermissionMock.mockResolvedValue(denied());
    const res = await listGET(new Request("http://localhost/api/follow-ups"));
    expect(res.status).toBe(403);
  });
});
