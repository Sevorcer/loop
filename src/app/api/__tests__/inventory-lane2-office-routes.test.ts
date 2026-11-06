import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  setVanPars: vi.fn(),
  updateVehicle: vi.fn(),
  getVehicleOrThrow: vi.fn(),
  ensureVanLocation: vi.fn(),
  replaceVehicleOperators: vi.fn(),
  createVehicle: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: m.requirePermission };
});

vi.mock("@/services/inventoryPars", () => ({ setVanPars: m.setVanPars }));
vi.mock("@/services/inventoryLocations", async () => {
  const actual = await vi.importActual<typeof import("@/services/inventoryLocations")>("@/services/inventoryLocations");
  return {
    ...actual,
    updateVehicle: m.updateVehicle,
    getVehicleOrThrow: m.getVehicleOrThrow,
    ensureVanLocation: m.ensureVanLocation,
    createVehicle: m.createVehicle,
  };
});
vi.mock("@/services/vehicleOperators", () => ({
  replaceVehicleOperators: m.replaceVehicleOperators,
  listVanOperators: vi.fn(),
  listVanPeople: vi.fn(),
}));

import { POST as postPars } from "@/app/api/inventory/pars/route";
import { POST as postVehicle } from "@/app/api/inventory/vehicles/route";
import { PATCH as patchVehicle } from "@/app/api/inventory/vehicles/[id]/route";

const allow = (role = "office") => ({ ok: true as const, ctx: { userId: "user-1", role } });
const deny = () => ({
  ok: false as const,
  response: NextResponse.json({ error: "FORBIDDEN", code: 403 }, { status: 403 }),
});

function req(method: string, body?: unknown) {
  return new Request("http://localhost/api/inventory/x", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.setVanPars.mockResolvedValue(1);
  m.updateVehicle.mockResolvedValue({ id: "v1", name: "Van 1" });
  m.getVehicleOrThrow.mockResolvedValue({ id: "v1", name: "Van 1" });
  m.ensureVanLocation.mockResolvedValue({ id: "loc-1" });
  m.replaceVehicleOperators.mockResolvedValue(undefined);
  m.createVehicle.mockResolvedValue({ vehicle: { id: "v1", name: "Van 1" }, location: { id: "loc-1" } });
});

describe("POST /api/inventory/pars", () => {
  it("requires location update and does not call the par function on 403", async () => {
    m.requirePermission.mockResolvedValue(deny());
    const res = await postPars(req("POST", { locationId: "loc", rows: [{ itemId: "a", minQty: 1, maxQty: 2 }] }));
    expect(res.status).toBe(403);
    expect(m.requirePermission).toHaveBeenCalledWith(expect.any(Request), "inventory_locations", "update");
    expect(m.setVanPars).not.toHaveBeenCalled();
  });

  it("saves rows for office and rejects a fill-to under the minimum", async () => {
    m.requirePermission.mockResolvedValue(allow("office"));
    const ok = await postPars(req("POST", { locationId: "loc", rows: [{ itemId: "a", minQty: 2, maxQty: null }] }));
    expect(ok.status).toBe(200);
    expect(m.setVanPars).toHaveBeenCalledWith("loc", [{ itemId: "a", minQty: 2, maxQty: null }]);

    m.setVanPars.mockClear();
    const bad = await postPars(req("POST", { locationId: "loc", rows: [{ itemId: "a", minQty: 4, maxQty: 1 }] }));
    expect(bad.status).toBe(400);
    expect(m.setVanPars).not.toHaveBeenCalled();
  });

});

describe("vehicle operators on the vehicles API", () => {
  it("assigns people on patch without treating it as a crew change", async () => {
    m.requirePermission.mockResolvedValue(allow("manager"));
    const res = await patchVehicle(
      req("PATCH", {
        plate: "ABC",
        operators: [{ userId: "casey", isHome: true }],
      }),
      { params: Promise.resolve({ id: "v1" }) },
    );
    expect(res.status).toBe(200);
    expect(m.updateVehicle).toHaveBeenCalledWith("v1", expect.objectContaining({ plate: "ABC" }));
    expect(m.replaceVehicleOperators).toHaveBeenCalledWith(
      "v1",
      [{ userId: "casey", isHome: true }],
      { canDelete: false },
    );
  });

  it("lets an owner remove people", async () => {
    m.requirePermission.mockResolvedValue(allow("owner"));
    const res = await patchVehicle(
      req("PATCH", { operators: [] }),
      { params: Promise.resolve({ id: "v1" }) },
    );
    expect(res.status).toBe(200);
    expect(m.updateVehicle).not.toHaveBeenCalled();
    expect(m.replaceVehicleOperators).toHaveBeenCalledWith("v1", [], { canDelete: true });
  });

  it("creates the location when asked and does not assign people unless operators are sent", async () => {
    m.requirePermission.mockResolvedValue(allow("office"));
    const res = await patchVehicle(
      req("PATCH", { ensureLocation: true }),
      { params: Promise.resolve({ id: "v1" }) },
    );
    expect(res.status).toBe(200);
    expect(m.ensureVanLocation).toHaveBeenCalled();
    expect(m.replaceVehicleOperators).not.toHaveBeenCalled();
  });

  it("assigns operators after the van is created and still leaves the crew off the vehicles table", async () => {
    m.requirePermission.mockResolvedValue(allow("office"));
    const res = await postVehicle(req("POST", {
      name: "Van 2",
      crewId: "crew-1",
      operators: [{ userId: "casey", isHome: true }],
    }));
    expect(res.status).toBe(201);
    expect(m.createVehicle).toHaveBeenCalledWith(expect.objectContaining({ name: "Van 2", crewId: "crew-1" }));
    const payload = m.createVehicle.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.operators).toBeUndefined();
    expect(m.replaceVehicleOperators).toHaveBeenCalledWith("v1", [{ userId: "casey", isHome: true }], { canDelete: false });
  });
});
