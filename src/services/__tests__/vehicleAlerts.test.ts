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

const VEHICLE_ID = "11111111-1111-4111-8111-111111111111";

const base = {
  vehicleId: VEHICLE_ID,
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
  it("links the picked vehicle", async () => {
    getVehicleMock.mockResolvedValue({ id: VEHICLE_ID, name: "Van 1", status: "active" });
    await createVehicleAlert(base);
    expect(getVehicleMock).toHaveBeenCalledWith(VEHICLE_ID);
    expect(createRecordMock).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: VEHICLE_ID }), undefined);
    expect(createRecordMock.mock.calls[0][0]).not.toHaveProperty("vehicleName");
  });

  it.each(["", "   ", "not-a-uuid"])("requires a real vehicle id (%j)", async (vehicleId) => {
    await expect(createVehicleAlert({ ...base, vehicleId })).rejects.toMatchObject({ status: 400 });
    expect(getVehicleMock).not.toHaveBeenCalled();
    expect(createRecordMock).not.toHaveBeenCalled();
  });

  it("rejects a vehicle that is not in the caller's org (lookup returns null)", async () => {
    getVehicleMock.mockResolvedValue(null);
    await expect(createVehicleAlert(base)).rejects.toMatchObject({ status: 400 });
    expect(createRecordMock).not.toHaveBeenCalled();
  });

  it("rejects a retired vehicle", async () => {
    getVehicleMock.mockResolvedValue({ id: VEHICLE_ID, name: "Old Van", status: "retired" });
    await expect(createVehicleAlert(base)).rejects.toMatchObject({ status: 400 });
    expect(createRecordMock).not.toHaveBeenCalled();
  });
});
