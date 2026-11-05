import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, downloadMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  downloadMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});
vi.mock("@/repositories/driveManuals", () => ({ downloadDriveManualFile: downloadMock }));

import { GET } from "@/app/api/manuals/[id]/file/route";

const ID = "33333333-3333-4333-8333-333333333333";
const allow = (role: string) => ({ ok: true as const, ctx: { userId: "u1", role } });
const params = (id = ID) => ({ params: Promise.resolve({ id }) });
const req = () => new Request(`http://localhost/api/manuals/${ID}/file`);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/manuals/:id/file", () => {
  it("passes through the permission guard response", async () => {
    requirePermissionMock.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) });
    expect((await GET(req(), params())).status).toBe(401);
    expect(requirePermissionMock).toHaveBeenCalledWith(expect.any(Request), "knowledge_items", "select");
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("denies portal before touching storage", async () => {
    requirePermissionMock.mockResolvedValue(allow("portal"));
    expect((await GET(req(), params())).status).toBe(403);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid id", async () => {
    requirePermissionMock.mockResolvedValue(allow("owner"));
    expect((await GET(req(), params("not-an-id"))).status).toBe(400);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the manual has no stored copy or is not in this org", async () => {
    requirePermissionMock.mockResolvedValue(allow("owner"));
    downloadMock.mockResolvedValue(null);
    expect((await GET(req(), params())).status).toBe(404);
  });

  it.each(["owner", "manager", "dispatch", "office", "sales", "tech"])("streams the PDF inline for %s", async (role) => {
    requirePermissionMock.mockResolvedValue(allow(role));
    downloadMock.mockResolvedValue({ blob: new Blob(["%PDF-1.7 test"]), name: "Trane XR 90 Install.pdf" });
    const res = await GET(req(), params());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/^inline; filename="Trane XR 90 Install\.pdf"/);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.text()).toBe("%PDF-1.7 test");
    expect(downloadMock).toHaveBeenCalledWith(ID);
  });

  it("keeps the Content-Disposition header ASCII-safe for odd names", async () => {
    requirePermissionMock.mockResolvedValue(allow("owner"));
    downloadMock.mockResolvedValue({ blob: new Blob(["x"]), name: 'Bosch "IDS" Guía.pdf' });
    const header = (await GET(req(), params())).headers.get("content-disposition") ?? "";
    expect(header).toContain('filename="Bosch _IDS_ Gu_a.pdf"');
    expect(header).toContain("filename*=UTF-8''Bosch%20%22IDS%22%20Gu%C3%ADa.pdf");
  });
});
