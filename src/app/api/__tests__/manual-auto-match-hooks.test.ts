import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createInstalledSystem: vi.fn(),
  updateInstalledSystem: vi.fn(),
  tryAutoMatch: vi.fn(),
  getCurrentOperator: vi.fn(),
  syncDriveManuals: vi.fn(),
  autoMatchAllSystems: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: m.requirePermission };
});
vi.mock("@/services/installedSystems", () => ({
  createInstalledSystem: m.createInstalledSystem,
  updateInstalledSystem: m.updateInstalledSystem,
  getInstalledSystemsSnapshot: vi.fn(),
  deleteInstalledSystem: vi.fn(),
}));
vi.mock("@/repositories/installedSystems", () => ({ getInstalledSystemById: vi.fn() }));
vi.mock("@/services/currentOperator", () => ({ getCurrentOperator: m.getCurrentOperator }));
vi.mock("@/services/jobs", () => ({ getJob: vi.fn() }));
vi.mock("@/services/manualAutoMatch", () => ({
  tryAutoMatchManualsForSystem: m.tryAutoMatch,
  autoMatchAllSystems: m.autoMatchAllSystems,
}));
vi.mock("@/services/driveManuals", () => ({ syncDriveManuals: m.syncDriveManuals }));

import { POST } from "@/app/api/installed-systems/route";
import { PATCH } from "@/app/api/installed-systems/[id]/route";
import { POST as SYNC } from "@/app/api/manuals/sync/route";

const SYS = "11111111-1111-4111-8111-111111111111";
const allow = (role: string) => ({ ok: true as const, ctx: { userId: "u", role } });
const req = (method: string, body: unknown) =>
  new Request("http://localhost/api/installed-systems", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe("#8 Copilot hooks", () => {
  it("auto-matches right after equipment is created and returns the reason", async () => {
    m.requirePermission.mockResolvedValue(allow("office"));
    m.createInstalledSystem.mockResolvedValue({ id: SYS });
    m.tryAutoMatch.mockResolvedValue({ action: "linked", manualId: "m1", confidence: 0.97, reason: "Linked X automatically (97%): Model MSZ-GL09NA is in the file name." });
    const res = await POST(req("POST", { systemName: "Head", manufacturer: "Mitsubishi", modelNumber: "MSZ-GL09NA", serialNumbers: ["SN-1"], installDate: "2026-11-04" }));
    expect(res.status).toBe(201);
    expect(m.tryAutoMatch).toHaveBeenCalledWith(SYS);
    expect((await res.json()).manualMatch.action).toBe("linked");
  });

  it("re-matches when brand/model changes, not for other edits", async () => {
    m.requirePermission.mockResolvedValue(allow("tech"));
    m.updateInstalledSystem.mockResolvedValue({ id: SYS });
    m.tryAutoMatch.mockResolvedValue({ action: "none", manualId: null, confidence: null, reason: "No manual" });
    const params = { params: Promise.resolve({ id: SYS }) };
    const res = await PATCH(req("PATCH", { modelNumber: "MSZ-GL12NA" }), params);
    expect((await res.json()).manualMatch.action).toBe("none");
    m.tryAutoMatch.mockClear();
    const res2 = await PATCH(req("PATCH", { location: "Attic" }), { params: Promise.resolve({ id: SYS }) });
    expect(m.tryAutoMatch).not.toHaveBeenCalled();
    expect(await res2.json()).not.toHaveProperty("manualMatch");
  });

  it("a Drive sync triggers the bulk re-match", async () => {
    m.requirePermission.mockResolvedValue(allow("office"));
    m.syncDriveManuals.mockImplementation(async (deps: { afterSync: (run: unknown) => Promise<void> }) => {
      await deps.afterSync({ id: "run" });
      return { id: "run", status: "ok" };
    });
    const res = await SYNC(new Request("http://localhost/api/manuals/sync", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(m.autoMatchAllSystems).toHaveBeenCalledTimes(1);
  });
});
