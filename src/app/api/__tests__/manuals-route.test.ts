import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, getSnapshotMock, syncMock, updateMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSnapshotMock: vi.fn(),
  syncMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});
vi.mock("@/services/driveManuals", () => ({
  getDriveManualsSnapshot: getSnapshotMock,
  syncDriveManuals: syncMock,
  updateDriveManual: updateMock,
}));

import { GET } from "@/app/api/manuals/route";
import { POST as SYNC } from "@/app/api/manuals/sync/route";
import { PATCH } from "@/app/api/manuals/[id]/route";
import { DriveNotConfiguredError, DriveSyncError, ManualValidationError } from "@/features/manuals/utils/manualErrors";

const ID = "33333333-3333-4333-8333-333333333333";
const allow = (role: string) => ({ ok: true as const, ctx: { userId: "u1", role } });
const params = (id = ID) => ({ params: Promise.resolve({ id }) });
const patchReq = (body: string) =>
  new Request(`http://localhost/api/manuals/${ID}`, { method: "PATCH", headers: { "content-type": "application/json" }, body });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/manuals", () => {
  it("passes through the permission guard response", async () => {
    requirePermissionMock.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) });
    expect((await GET(new Request("http://localhost/api/manuals"))).status).toBe(401);
    expect(requirePermissionMock).toHaveBeenCalledWith(expect.any(Request), "knowledge_items", "select");
  });

  it.each(["owner", "office", "tech", "sales"])("lets %s read", async (role) => {
    requirePermissionMock.mockResolvedValue(allow(role));
    getSnapshotMock.mockResolvedValue({ files: [], canManage: false });
    const res = await GET(new Request("http://localhost/api/manuals"));
    expect(res.status).toBe(200);
    expect(getSnapshotMock).toHaveBeenCalledWith(role);
  });

  it("denies portal", async () => {
    requirePermissionMock.mockResolvedValue(allow("portal"));
    expect((await GET(new Request("http://localhost/api/manuals"))).status).toBe(403);
  });
});

describe("POST /api/manuals/sync", () => {
  it.each(["tech", "sales"])("forbids %s", async (role) => {
    requirePermissionMock.mockResolvedValue(allow(role));
    expect((await SYNC(new Request("http://localhost/api/manuals/sync", { method: "POST" }))).status).toBe(403);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("returns 503 until Drive is configured", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    syncMock.mockRejectedValue(new DriveNotConfiguredError(["GOOGLE_DRIVE_MANUAL_FOLDER_IDS"]));
    const res = await SYNC(new Request("http://localhost/api/manuals/sync", { method: "POST" }));
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).toContain("GOOGLE_DRIVE_MANUAL_FOLDER_IDS");
  });

  it("maps a Google-side 403 to 502 (setup problem, not caller permission)", async () => {
    requirePermissionMock.mockResolvedValue(allow("owner"));
    syncMock.mockRejectedValue(new DriveSyncError("not shared", 403));
    expect((await SYNC(new Request("http://localhost/api/manuals/sync", { method: "POST" }))).status).toBe(502);
  });

  it("returns the run", async () => {
    requirePermissionMock.mockResolvedValue(allow("dispatch"));
    syncMock.mockResolvedValue({ id: "run-1", status: "ok" });
    const res = await SYNC(new Request("http://localhost/api/manuals/sync", { method: "POST" }));
    expect(res.status).toBe(200);
    expect((await res.json()).run.id).toBe("run-1");
  });
});

describe("PATCH /api/manuals/[id]", () => {
  it("forbids tech", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    expect((await PATCH(patchReq("{}"), params())).status).toBe(403);
  });

  it("rejects a bad id, bad JSON and non-object bodies", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    expect((await PATCH(patchReq("{}"), params("nope"))).status).toBe(400);
    expect((await PATCH(patchReq("{bad"), params())).status).toBe(400);
    expect((await PATCH(patchReq("[1]"), params())).status).toBe(400);
  });

  it("maps validation errors to 400 and returns the manual", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    updateMock.mockRejectedValueOnce(new ManualValidationError("Nothing to update."));
    expect((await PATCH(patchReq("{}"), params())).status).toBe(400);
    updateMock.mockResolvedValueOnce({ id: ID, manufacturer: "Daikin" });
    const res = await PATCH(patchReq(JSON.stringify({ manufacturer: "Daikin" })), params());
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(ID, { manufacturer: "Daikin" });
  });
});
