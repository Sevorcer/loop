import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  createVehicleRecord: vi.fn(),
  getVehicle: vi.fn(),
  listVehicleRecords: vi.fn(),
  relinkCrewVehicle: vi.fn(),
  updateVehicleRecord: vi.fn(),
  getVanLocationForVehicle: vi.fn(),
  createVanLocation: vi.fn(),
  listLocationRecords: vi.fn(),
  updateLocationRecord: vi.fn(),
}));

vi.mock("@/repositories/vehicles", () => ({
  createVehicle: m.createVehicleRecord,
  getVehicle: m.getVehicle,
  listVehicles: m.listVehicleRecords,
  relinkCrewVehicle: m.relinkCrewVehicle,
  updateVehicle: m.updateVehicleRecord,
}));

vi.mock("@/repositories/inventoryLocations", () => ({
  createLocation: vi.fn(),
  createVanLocation: m.createVanLocation,
  getLocation: vi.fn(),
  getVanLocationForVehicle: m.getVanLocationForVehicle,
  listLocations: m.listLocationRecords,
  updateLocation: m.updateLocationRecord,
}));

import { createVehicle, updateVehicle } from "@/services/inventoryLocations";

const van = (crewId: string | null) => ({
  id: "veh-1",
  name: "Van 1",
  plate: null,
  vin: null,
  status: "active" as const,
  crewId,
  notes: null,
});

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.getVanLocationForVehicle.mockResolvedValue({ id: "loc-1", name: "Van 1", isActive: true });
});

describe("vehicle crew link (crews.vehicle_id is the single source)", () => {
  it("relinks when the crew changes", async () => {
    m.getVehicle.mockResolvedValue(van("crew-a"));
    m.updateVehicleRecord.mockResolvedValue(van("crew-b"));
    await updateVehicle("veh-1", { crewId: "crew-b" });
    expect(m.relinkCrewVehicle).toHaveBeenCalledWith("veh-1", "crew-b");
  });

  it("does not touch crews when the crew is unchanged (office can still edit other fields)", async () => {
    m.getVehicle.mockResolvedValue(van("crew-a"));
    m.updateVehicleRecord.mockResolvedValue(van("crew-a"));
    await updateVehicle("veh-1", { crewId: "crew-a", plate: "ABC123" });
    expect(m.relinkCrewVehicle).not.toHaveBeenCalled();
  });

  it("frees the van when the crew is cleared", async () => {
    m.getVehicle.mockResolvedValue(van("crew-a"));
    m.updateVehicleRecord.mockResolvedValue(van(null));
    await updateVehicle("veh-1", { crewId: null });
    expect(m.relinkCrewVehicle).toHaveBeenCalledWith("veh-1", null);
  });

  it("never sends a crew to the vehicles table", async () => {
    m.getVehicle.mockResolvedValue(van("crew-a"));
    m.updateVehicleRecord.mockResolvedValue(van("crew-b"));
    await updateVehicle("veh-1", { crewId: "crew-b", plate: "X" });
    const patch = m.updateVehicleRecord.mock.calls[0][1] as Record<string, unknown>;
    expect(patch.plate).toBe("X");
    expect(patch.crewId).toBeUndefined();
  });

  it("creates the van first, then links the crew, and reports a denied link clearly", async () => {
    m.createVehicleRecord.mockResolvedValue(van(null));
    m.relinkCrewVehicle.mockRejectedValue(Object.assign(new Error("Forbidden."), { status: 403 }));
    await expect(createVehicle({ name: "Van 1", crewId: "crew-a" })).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("was added, but it could not be assigned"),
    });
    expect(m.createVehicleRecord).toHaveBeenCalledWith(expect.objectContaining({ crewId: null }));
  });

  it("creates a van with no crew without touching crews", async () => {
    m.createVehicleRecord.mockResolvedValue(van(null));
    const result = await createVehicle({ name: "Van 1" });
    expect(result.vehicle.id).toBe("veh-1");
    expect(m.relinkCrewVehicle).not.toHaveBeenCalled();
  });
});
