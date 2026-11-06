import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  getVehicle: vi.fn(),
  listVehicleOperators: vi.fn(),
  profileIdsInOrg: vi.fn(),
  clearHomeForUser: vi.fn(),
  deleteVehicleOperator: vi.fn(),
  setVehicleOperatorHome: vi.fn(),
  insertVehicleOperator: vi.fn(),
}));

vi.mock("@/repositories/vehicles", () => ({ getVehicle: m.getVehicle }));
vi.mock("@/repositories/vehicleOperators", () => ({
  listVehicleOperators: m.listVehicleOperators,
  listTeamMembers: vi.fn(),
  profileIdsInOrg: m.profileIdsInOrg,
  clearHomeForUser: m.clearHomeForUser,
  deleteVehicleOperator: m.deleteVehicleOperator,
  setVehicleOperatorHome: m.setVehicleOperatorHome,
  insertVehicleOperator: m.insertVehicleOperator,
}));

import { replaceVehicleOperators } from "@/services/vehicleOperators";

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.getVehicle.mockResolvedValue({ id: "van-1", name: "Van 1" });
  m.profileIdsInOrg.mockImplementation(async (ids: string[]) => new Set(ids));
  m.clearHomeForUser.mockResolvedValue(undefined);
  m.deleteVehicleOperator.mockResolvedValue(undefined);
  m.setVehicleOperatorHome.mockResolvedValue(undefined);
  m.insertVehicleOperator.mockResolvedValue(undefined);
});

describe("replaceVehicleOperators", () => {
  it("clears the other home van before adding the new home", async () => {
    m.listVehicleOperators.mockResolvedValue([]);
    await replaceVehicleOperators("van-1", [{ userId: "casey", isHome: true }], { canDelete: false });
    expect(m.clearHomeForUser).toHaveBeenCalledWith("casey", "van-1");
    expect(m.insertVehicleOperator).toHaveBeenCalledWith({ vehicleId: "van-1", userId: "casey", isHome: true });
    const clearOrder = m.clearHomeForUser.mock.invocationCallOrder[0];
    const insertOrder = m.insertVehicleOperator.mock.invocationCallOrder[0];
    expect(clearOrder).toBeLessThan(insertOrder);
  });

  it("refuses a removal when the caller cannot delete assignments", async () => {
    m.listVehicleOperators.mockResolvedValue([{ id: "row", vehicleId: "van-1", userId: "nate", isHome: true }]);
    await expect(
      replaceVehicleOperators("van-1", [], { canDelete: false }),
    ).rejects.toMatchObject({ status: 403, message: expect.stringContaining("owner") });
    expect(m.deleteVehicleOperator).not.toHaveBeenCalled();
  });

  it("removes when the caller is allowed, and does not touch crews", async () => {
    m.listVehicleOperators.mockResolvedValue([{ id: "row", vehicleId: "van-1", userId: "nate", isHome: false }]);
    await replaceVehicleOperators("van-1", [], { canDelete: true });
    expect(m.deleteVehicleOperator).toHaveBeenCalledWith("van-1", "nate");
  });

  it("rejects a person who is not on the team", async () => {
    m.listVehicleOperators.mockResolvedValue([]);
    m.profileIdsInOrg.mockResolvedValue(new Set());
    await expect(
      replaceVehicleOperators("van-1", [{ userId: "missing", isHome: true }], { canDelete: true }),
    ).rejects.toMatchObject({ status: 400 });
    expect(m.insertVehicleOperator).not.toHaveBeenCalled();
  });
});
