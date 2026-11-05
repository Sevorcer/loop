import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createRecordMock, getVehicleMock } = vi.hoisted(() => ({
  createRecordMock: vi.fn(),
  getVehicleMock: vi.fn(),
}));

vi.mock("@/repositories/vehicleAlerts", () => ({
  createVehicleAlertRecord: createRecordMock,
  listVehicleAlerts: vi.fn(),
  updateVehicleAlertStatusRecord: vi.fn(),
}));

vi.mock("@/repositories/vehicles", () => ({
  getVehicle: getVehicleMock,
}));

import { createVehicleAlert } from "@/services/vehicleAlerts";

const base = {
  title: "Tire",
  description: "Flat",
  priority: "High" as const,
  reportedByUserId: "user-1",
};

beforeEach(() => {
  createRecordMock.mockReset();
  getVehicleMock.mockReset();
  createRecordMock.mockResolvedValue({ id: "va-1" });
});

describe("createVehicleAlert vehicle resolution", () => {
  it("links a picked vehicle and snapshots its name", async () => {
    getVehicleMock.mockResolvedValue({ id: "veh-1", name: "Van 1", status: "active" });
    await createVehicleAlert({ ...base, vehicleId: "veh-1", vehicleName: "ignored text" });
    expect(createRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: "veh-1", vehicleName: "Van 1" }),
      undefined,
    );
  });

  it("accepts free text when no vehicle is picked (before any vehicle exists)", async () => {
    await createVehicleAlert({ ...base, vehicleName: "  Unmarked Van  " });
    expect(getVehicleMock).not.toHaveBeenCalled();
    expect(createRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: null, vehicleName: "Unmarked Van" }),
      undefined,
    );
  });

  it("requires a vehicle pick or a typed name", async () => {
    await expect(createVehicleAlert({ ...base, vehicleName: "   " })).rejects.toMatchObject({ status: 400 });
    expect(createRecordMock).not.toHaveBeenCalled();
  });

  it("rejects a vehicle that is not in the caller's org (lookup returns null)", async () => {
    getVehicleMock.mockResolvedValue(null);
    await expect(createVehicleAlert({ ...base, vehicleId: "other-org-van" })).rejects.toMatchObject({ status: 400 });
    expect(createRecordMock).not.toHaveBeenCalled();
  });

  it("rejects a retired vehicle", async () => {
    getVehicleMock.mockResolvedValue({ id: "veh-9", name: "Old Van", status: "retired" });
    await expect(createVehicleAlert({ ...base, vehicleId: "veh-9" })).rejects.toMatchObject({ status: 400 });
    expect(createRecordMock).not.toHaveBeenCalled();
  });
});
