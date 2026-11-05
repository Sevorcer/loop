import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, getMock, decideMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getMock: vi.fn(),
  decideMock: vi.fn(),
}));
vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});
vi.mock("@/services/installedSystemManuals", () => ({
  getInstalledSystemManuals: getMock,
  decideInstalledSystemManual: decideMock,
}));

import { GET, POST } from "@/app/api/installed-systems/[id]/manuals/route";
import { ManualValidationError } from "@/features/manuals/utils/manualErrors";

const SYS = "11111111-1111-4111-8111-111111111111";
const allow = (role: string) => ({ ok: true as const, ctx: { userId: "u", role } });
const params = (id = SYS) => ({ params: Promise.resolve({ id }) });
const post = (body: string) => new Request(`http://localhost/api/installed-systems/${SYS}/manuals`, { method: "POST", headers: { "content-type": "application/json" }, body });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/installed-systems/[id]/manuals", () => {
  it("uses the installed_systems select guard and passes the role", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    getMock.mockResolvedValue({ systemId: SYS, linked: [] });
    const res = await GET(new Request("http://localhost"), params());
    expect(res.status).toBe(200);
    expect(requirePermissionMock).toHaveBeenCalledWith(expect.any(Request), "installed_systems", "select");
    expect(getMock).toHaveBeenCalledWith(SYS, "tech");
  });

  it("guard failure, portal, bad id and missing system", async () => {
    requirePermissionMock.mockResolvedValueOnce({ ok: false, response: NextResponse.json({}, { status: 401 }) });
    expect((await GET(new Request("http://localhost"), params())).status).toBe(401);
    requirePermissionMock.mockResolvedValue(allow("portal"));
    expect((await GET(new Request("http://localhost"), params())).status).toBe(403);
    requirePermissionMock.mockResolvedValue(allow("office"));
    expect((await GET(new Request("http://localhost"), params("x"))).status).toBe(400);
    getMock.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), params())).status).toBe(404);
  });
});

describe("POST /api/installed-systems/[id]/manuals", () => {
  it.each(["tech", "sales"])("forbids %s", async (role) => {
    requirePermissionMock.mockResolvedValue(allow(role));
    expect((await POST(post("{}"), params())).status).toBe(403);
    expect(decideMock).not.toHaveBeenCalled();
  });

  it("400s for bad JSON / arrays / validation errors", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    expect((await POST(post("{"), params())).status).toBe(400);
    expect((await POST(post("[]"), params())).status).toBe(400);
    decideMock.mockRejectedValueOnce(new ManualValidationError("bad"));
    expect((await POST(post("{}"), params())).status).toBe(400);
  });

  it("maps 404 errors and returns the decision", async () => {
    requirePermissionMock.mockResolvedValue(allow("dispatch"));
    decideMock.mockRejectedValueOnce(Object.assign(new Error("Manual not found."), { status: 404 }));
    expect((await POST(post(JSON.stringify({ manualId: SYS, action: "confirm" })), params())).status).toBe(404);
    decideMock.mockResolvedValueOnce({ status: "confirmed" });
    const res = await POST(post(JSON.stringify({ manualId: SYS, action: "confirm" })), params());
    expect(res.status).toBe(200);
    expect((await res.json()).result.status).toBe("confirmed");
  });
});
