import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getKitTemplate: vi.fn(),
  listKitSummaries: vi.fn(),
  saveKitTemplate: vi.fn(),
  getInventorySettings: vi.fn(),
  saveInventorySettings: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: m.requirePermission };
});
vi.mock("@/repositories/kitTemplates", () => ({
  getKitTemplate: m.getKitTemplate,
  listKitSummaries: m.listKitSummaries,
  saveKitTemplate: m.saveKitTemplate,
}));
vi.mock("@/repositories/inventorySettings", () => ({
  getInventorySettings: m.getInventorySettings,
  saveInventorySettings: m.saveInventorySettings,
}));

import { GET as listKitsRoute, POST as createKitRoute } from "@/app/api/inventory/kits/route";
import { GET as getKitRoute, PATCH as patchKitRoute } from "@/app/api/inventory/kits/[id]/route";
import { GET as getSettingsRoute, PATCH as patchSettingsRoute } from "@/app/api/inventory/settings/route";

const KIT = "33333333-3333-4333-8333-333333333333";
const ITEM = "44444444-4444-4444-8444-444444444444";
const NEW_KIT = "55555555-5555-4555-8555-555555555555";

const allow = (role = "office") => ({ ok: true as const, ctx: { userId: "user-1", role } });
const deny = (status: 401 | 403) => ({
  ok: false as const,
  response: NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", code: status }, { status }),
});

function req(method: string, body?: unknown, url = "http://localhost/api/inventory/x") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id = KIT) => ({ params: Promise.resolve({ id }) });

const kit = {
  id: KIT,
  name: "Gas furnace swap",
  description: null,
  category: null,
  status: "active",
  version: 1,
  createdAt: "2026-11-05T00:00:00Z",
  updatedAt: "2026-11-05T00:00:00Z",
  lines: [],
};

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
});

describe("kit routes: permission gate", () => {
  it.each([
    ["kits GET", () => listKitsRoute(req("GET")), "kit_templates", "select"],
    ["kits POST", () => createKitRoute(req("POST", {})), "kit_templates", "insert"],
    ["kit GET", () => getKitRoute(req("GET"), ctx()), "kit_templates", "select"],
    ["kit PATCH", () => patchKitRoute(req("PATCH", {}), ctx()), "kit_templates", "update"],
    ["settings GET", () => getSettingsRoute(req("GET")), "inventory_settings", "select"],
    ["settings PATCH", () => patchSettingsRoute(req("PATCH", {})), "inventory_settings", "update"],
  ])("%s asks for the right table and action and stops on 403", async (_label, call, table, action) => {
    m.requirePermission.mockResolvedValue(deny(403));
    const res = await call();
    expect(res.status).toBe(403);
    expect(m.requirePermission).toHaveBeenCalledWith(expect.any(Request), table, action);
    expect(m.saveKitTemplate).not.toHaveBeenCalled();
    expect(m.saveInventorySettings).not.toHaveBeenCalled();
  });

  it("returns 401 untouched when there is no session", async () => {
    m.requirePermission.mockResolvedValue(deny(401));
    expect((await createKitRoute(req("POST", { name: "x" }))).status).toBe(401);
  });
});

describe("POST /api/inventory/kits", () => {
  it("requires a name and writes nothing without one", async () => {
    m.requirePermission.mockResolvedValue(allow());
    expect((await createKitRoute(req("POST", { description: "d" }))).status).toBe(400);
    expect(m.saveKitTemplate).not.toHaveBeenCalled();
  });

  it("rejects free-text lines: kits are built from catalog items", async () => {
    m.requirePermission.mockResolvedValue(allow());
    const res = await createKitRoute(req("POST", { name: "K", lines: [{ name: "Pipe dope", quantity: 1 }] }));
    expect(res.status).toBe(400);
    expect(m.saveKitTemplate).not.toHaveBeenCalled();
  });

  it("creates a kit and returns it with 201", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.saveKitTemplate.mockResolvedValue(KIT);
    m.getKitTemplate.mockResolvedValue(kit);
    const res = await createKitRoute(req("POST", { name: " Gas furnace swap ", lines: [{ catalogItemId: ITEM, quantity: 2 }] }));
    expect(res.status).toBe(201);
    const call = m.saveKitTemplate.mock.calls[0][0];
    expect(call.id).toBeNull();
    expect(call.header.name).toBe("Gas furnace swap");
    expect(call.lines).toEqual([{ catalogItemId: ITEM, quantity: 2, isOptional: false, notes: null }]);
  });

  it("duplicates a kit by copying its lines and category", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.getKitTemplate.mockResolvedValueOnce({
      ...kit,
      category: "Furnace",
      lines: [{ id: "l1", catalogItemId: ITEM, itemName: "Wire nuts", sku: null, unit: "ea", itemKind: "consumable", itemActive: true, quantity: 3, isOptional: true, notes: null, sortOrder: 1 }],
    });
    m.saveKitTemplate.mockResolvedValue(NEW_KIT);
    m.getKitTemplate.mockResolvedValueOnce({ ...kit, id: NEW_KIT });
    const res = await createKitRoute(req("POST", { name: "Copy", copyFromId: KIT }));
    expect(res.status).toBe(201);
    const call = m.saveKitTemplate.mock.calls[0][0];
    expect(call.header.category).toBe("Furnace");
    expect(call.lines).toEqual([{ catalogItemId: ITEM, quantity: 3, isOptional: true, notes: null }]);
  });

  it("refuses to combine copyFromId with lines", async () => {
    m.requirePermission.mockResolvedValue(allow());
    const res = await createKitRoute(req("POST", { name: "Copy", copyFromId: KIT, lines: [] }));
    expect(res.status).toBe(400);
    expect(m.saveKitTemplate).not.toHaveBeenCalled();
  });

  it("maps a duplicate-name database conflict to 409", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.saveKitTemplate.mockRejectedValue(Object.assign(new Error("A kit with that name already exists."), { status: 409 }));
    expect((await createKitRoute(req("POST", { name: "Dup" }))).status).toBe(409);
  });
});

describe("PATCH /api/inventory/kits/[id]", () => {
  it("rejects an empty change", async () => {
    m.requirePermission.mockResolvedValue(allow());
    expect((await patchKitRoute(req("PATCH", {}), ctx())).status).toBe(400);
    expect(m.saveKitTemplate).not.toHaveBeenCalled();
  });

  it("leaves lines untouched when only the header is sent", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.saveKitTemplate.mockResolvedValue(KIT);
    m.getKitTemplate.mockResolvedValue(kit);
    const res = await patchKitRoute(req("PATCH", { status: "archived" }), ctx());
    expect(res.status).toBe(200);
    const call = m.saveKitTemplate.mock.calls[0][0];
    expect(call.header).toEqual({ status: "archived" });
    expect(call.lines).toBeUndefined();
  });

  it("ignores unknown keys like version and org_id", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.saveKitTemplate.mockResolvedValue(KIT);
    m.getKitTemplate.mockResolvedValue(kit);
    await patchKitRoute(req("PATCH", { name: "New", version: 99, org_id: "x" }), ctx());
    expect(m.saveKitTemplate.mock.calls[0][0].header).toEqual({ name: "New" });
  });

  it("404s a malformed id without touching the database", async () => {
    m.requirePermission.mockResolvedValue(allow());
    expect((await patchKitRoute(req("PATCH", { name: "x" }), ctx("nope"))).status).toBe(404);
    expect(m.saveKitTemplate).not.toHaveBeenCalled();
  });

  it("404s a kit that does not exist", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.getKitTemplate.mockResolvedValue(null);
    expect((await getKitRoute(req("GET"), ctx())).status).toBe(404);
  });

  it("rejects a non-object body", async () => {
    m.requirePermission.mockResolvedValue(allow());
    expect((await patchKitRoute(req("PATCH", [1, 2]), ctx())).status).toBe(400);
  });
});

describe("/api/inventory/settings", () => {
  it("returns defaults when nothing is saved", async () => {
    m.requirePermission.mockResolvedValue(allow("manager"));
    m.getInventorySettings.mockResolvedValue({ readinessLeadDays: 3, arrivalBufferDays: 1, closeoutEnforcement: "warn", isDefault: true, updatedAt: null });
    const res = await getSettingsRoute(req("GET"));
    expect(res.status).toBe(200);
    expect((await res.json()).settings.isDefault).toBe(true);
  });

  it("saves valid lead/buffer days", async () => {
    m.requirePermission.mockResolvedValue(allow("owner"));
    m.saveInventorySettings.mockResolvedValue({ readinessLeadDays: 5, arrivalBufferDays: 2, closeoutEnforcement: "warn", isDefault: false, updatedAt: "now" });
    const res = await patchSettingsRoute(req("PATCH", { readinessLeadDays: 5, arrivalBufferDays: 2 }));
    expect(res.status).toBe(200);
    expect(m.saveInventorySettings).toHaveBeenCalledWith({ readinessLeadDays: 5, arrivalBufferDays: 2 });
  });

  it("refuses an out-of-range value and an unknown closeout stage", async () => {
    m.requirePermission.mockResolvedValue(allow("owner"));
    expect((await patchSettingsRoute(req("PATCH", { readinessLeadDays: 99 }))).status).toBe(400);
    expect((await patchSettingsRoute(req("PATCH", { closeoutEnforcement: "strict" }))).status).toBe(400);
    expect(m.saveInventorySettings).not.toHaveBeenCalled();
  });
});
