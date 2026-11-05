import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, getMock, setMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getMock: vi.fn(),
  setMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/services/orgSettings", () => ({
  getFinancialsVisibility: getMock,
  setFinancialsVisibilityForRole: setMock,
}));

import { GET, PUT } from "../settings/financial-visibility/route";

function req(method = "GET", body?: unknown) {
  return new Request("http://localhost/api/settings/financial-visibility", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}

describe("/api/settings/financial-visibility", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getMock.mockReset();
    setMock.mockReset();
  });

  it("returns the guard failure untouched", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response("no", { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("GET is owner-only even when the broad organizations select passes", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { role: "office", userId: "u-2" },
    });
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("GET returns the current visibility for the owner", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { role: "owner", userId: "u-1" },
    });
    getMock.mockResolvedValue("owner");
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ visibility: "owner" });
  });

  it("PUT delegates to the owner-gated service", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { role: "owner", userId: "u-1" },
    });
    setMock.mockResolvedValue("owner_manager");
    const res = await PUT(req("PUT", { visibility: "owner_manager" }));
    expect(res.status).toBe(200);
    expect(setMock).toHaveBeenCalledWith("owner", "u-1", "owner_manager");
  });

  it("PUT maps the service 403 for non-owners", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { role: "manager", userId: "u-3" },
    });
    setMock.mockRejectedValue(
      Object.assign(new Error("Only the owner can change this setting."), {
        status: 403,
      }),
    );
    const res = await PUT(req("PUT", { visibility: "revenue_roles" }));
    expect(res.status).toBe(403);
  });
});
