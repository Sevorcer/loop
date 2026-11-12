import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getSerialUnit: vi.fn(),
  rmaSerialUnit: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: m.requirePermission };
});
vi.mock("@/repositories/inventorySerialUnits", () => ({
  listSerialUnits: vi.fn(),
  getSerialUnit: m.getSerialUnit,
  listSerialReviewQueue: vi.fn(),
  clearSerialUnitReview: vi.fn(),
  scrapDetachedUnit: vi.fn(),
  rmaSerialUnit: m.rmaSerialUnit,
}));
vi.mock("@/repositories/installedSystems", () => ({
  getInstalledSystemSerials: vi.fn(),
  setInstalledSystemSerials: vi.fn(),
}));

import { POST as rmaRoute } from "@/app/api/inventory/serials/[id]/rma/route";

const UNIT = "11111111-1111-4111-8111-111111111111";
const SHELF = "33333333-3333-4333-8333-333333333333";

const allow = (role = "office") => ({ ok: true as const, ctx: { userId: "user-1", role } });
const deny = (status: 401 | 403) => ({
  ok: false as const,
  response: NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", code: status }, { status }),
});

function post(body: unknown) {
  return new Request(`http://localhost/api/inventory/serials/${UNIT}/rma`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const ctx = (id = UNIT) => ({ params: Promise.resolve({ id }) });

const unitIn = (status: string) => ({
  id: UNIT,
  itemId: "item-1",
  manufacturer: "Mitsubishi",
  modelNumber: "MXZ",
  serialNumber: "SN-1",
  status,
  locationId: status === "in_stock" || status === "quarantine" ? SHELF : null,
  installedSystemId: null,
  source: "receipt",
  needsReview: false,
  reviewReason: null,
  createdAt: "2026-11-11T00:00:00Z",
  updatedAt: "2026-11-11T00:00:00Z",
});

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.requirePermission.mockResolvedValue(allow());
});

describe("POST /api/inventory/serials/[id]/rma", () => {
  it.each([401, 403] as const)("stops on %s before any data call", async (status) => {
    m.requirePermission.mockResolvedValueOnce(deny(status));
    const response = await rmaRoute(post({ action: "scrap" }), ctx());
    expect(response.status).toBe(status);
    expect(m.requirePermission).toHaveBeenCalledWith(expect.any(Request), "inventory_serial_units", "update");
    expect(m.getSerialUnit).not.toHaveBeenCalled();
    expect(m.rmaSerialUnit).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const response = await rmaRoute(post("{nope"), ctx());
    expect(response.status).toBe(400);
    expect(m.rmaSerialUnit).not.toHaveBeenCalled();
  });

  it.each([
    [{ action: "explode" }],
    [{ action: "repair" }],
    [{ action: "scrap", locationId: SHELF }],
    [{}],
  ])("rejects an invalid command %j without touching the unit", async (body) => {
    const response = await rmaRoute(post(body), ctx());
    expect(response.status).toBe(400);
    expect(m.getSerialUnit).not.toHaveBeenCalled();
    expect(m.rmaSerialUnit).not.toHaveBeenCalled();
  });

  it("404s for a unit that does not exist", async () => {
    m.getSerialUnit.mockResolvedValue(null);
    const response = await rmaRoute(post({ action: "quarantine" }), ctx());
    expect(response.status).toBe(404);
    expect(m.rmaSerialUnit).not.toHaveBeenCalled();
  });

  it("quarantines a unit in stock and returns it", async () => {
    m.getSerialUnit.mockResolvedValue(unitIn("in_stock"));
    m.rmaSerialUnit.mockResolvedValue(unitIn("quarantine"));
    const response = await rmaRoute(post({ action: "quarantine", note: "compressor seized" }), ctx());
    expect(response.status).toBe(200);
    expect((await response.json()).unit.status).toBe("quarantine");
    expect(m.rmaSerialUnit).toHaveBeenCalledWith(UNIT, { action: "quarantine", note: "compressor seized" });
  });

  it("repairs a quarantined unit back to a location", async () => {
    m.getSerialUnit.mockResolvedValue(unitIn("quarantine"));
    m.rmaSerialUnit.mockResolvedValue(unitIn("in_stock"));
    const response = await rmaRoute(post({ action: "repair", locationId: SHELF }), ctx());
    expect(response.status).toBe(200);
    expect(m.rmaSerialUnit).toHaveBeenCalledWith(UNIT, { action: "repair", locationId: SHELF });
  });

  it.each([
    ["in_stock", "scrap"],
    ["installed", "repair"],
    ["in_stock", "return_to_supplier"],
    ["quarantine", "quarantine"],
    ["scrapped", "quarantine"],
    ["returned_to_supplier", "scrap"],
  ])("a %s unit cannot %s: 400 and nothing changes", async (status, action) => {
    m.getSerialUnit.mockResolvedValue(unitIn(status));
    const body = action === "repair" ? { action, locationId: SHELF } : { action };
    const response = await rmaRoute(post(body), ctx());
    expect(response.status).toBe(400);
    expect(m.rmaSerialUnit).not.toHaveBeenCalled();
  });

  it("passes a database refusal through as a 400 with its message", async () => {
    m.getSerialUnit.mockResolvedValue(unitIn("in_stock"));
    m.rmaSerialUnit.mockRejectedValue(
      Object.assign(new Error("resolve this unit's duplicate serial in the review queue first"), { status: 400 }),
    );
    const response = await rmaRoute(post({ action: "quarantine" }), ctx());
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain("duplicate serial");
  });

  it("404s when the database function cannot find the unit", async () => {
    m.getSerialUnit.mockResolvedValue(unitIn("in_stock"));
    m.rmaSerialUnit.mockResolvedValue(null);
    const response = await rmaRoute(post({ action: "quarantine" }), ctx());
    expect(response.status).toBe(404);
  });
});
