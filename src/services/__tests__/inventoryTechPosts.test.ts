import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  listVehicleOperators: vi.fn(),
  listVehiclesById: vi.fn(),
  listMyVanActivity: vi.fn(),
  postMyVanEntries: vi.fn(),
  getVanLocationForVehicle: vi.fn(),
  listLocations: vi.fn(),
  listItems: vi.fn(),
  getItem: vi.fn(),
  listStockLevels: vi.fn(),
  listCountedLocationIds: vi.fn(),
  appendLedgerRows: vi.fn(),
  listTransactions: vi.fn(),
}));

vi.mock("@/repositories/vehicleOperators", () => ({
  listVehicleOperators: m.listVehicleOperators,
}));
vi.mock("@/repositories/myVan", () => ({
  listVehiclesById: m.listVehiclesById,
  listMyVanActivity: m.listMyVanActivity,
  postMyVanEntries: m.postMyVanEntries,
}));
vi.mock("@/repositories/inventoryLocations", () => ({
  getVanLocationForVehicle: m.getVanLocationForVehicle,
  listLocations: m.listLocations,
}));
vi.mock("@/repositories/catalog", () => ({
  listItems: m.listItems,
  getItem: m.getItem,
}));
vi.mock("@/repositories/inventoryLedger", () => ({
  listStockLevels: m.listStockLevels,
  listCountedLocationIds: m.listCountedLocationIds,
  appendLedgerRows: m.appendLedgerRows,
  listTransactions: m.listTransactions,
}));

import { postTechVanCount, postTechVanRestock } from "@/services/inventoryTechPosts";

const capacitor = { id: "cap", name: "Capacitor", isStockable: true, isActive: true };

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.listVehicleOperators.mockResolvedValue([
    { id: "op-1", vehicleId: "van-1", userId: "tech-1", isHome: true },
    { id: "op-2", vehicleId: "van-2", userId: "other", isHome: true },
  ]);
  m.listVehiclesById.mockResolvedValue([{ id: "van-1", name: "Van 1", plate: null, status: "active" }]);
  m.getVanLocationForVehicle.mockResolvedValue({
    id: "loc-van",
    type: "van",
    name: "Van 1",
    vehicleId: "van-1",
    parentLocationId: "loc-shop",
    isActive: true,
  });
  m.listMyVanActivity.mockResolvedValue([
    { id: "c1", txnType: "count", itemId: "cap", locationId: "loc-van", qtyDelta: 2, reason: "Initial count-in", createdAt: "2026-11-01T00:00:00.000Z" },
  ]);
  m.listItems.mockResolvedValue([capacitor]);
  m.getItem.mockResolvedValue(null);
  m.listStockLevels.mockResolvedValue([{ itemId: "cap", locationId: "loc-van", onHand: 1, minQty: 2, maxQty: 4 }]);
  m.listLocations.mockResolvedValue([
    { id: "loc-shop", type: "warehouse", name: "Shop warehouse", parentLocationId: null, vehicleId: null, isActive: true },
    { id: "loc-van", type: "van", name: "Van 1", parentLocationId: "loc-shop", vehicleId: "van-1", isActive: true },
  ]);
  m.postMyVanEntries.mockResolvedValue(1);
});

describe("postTechVanCount", () => {
  it("posts a recount for the assigned van and skips a match", async () => {
    m.listItems.mockResolvedValue([
      capacitor,
      { id: "whip", name: "Whip", isStockable: true, isActive: true },
    ]);
    m.listStockLevels.mockResolvedValue([
      { itemId: "cap", locationId: "loc-van", onHand: 1, minQty: 2, maxQty: 4 },
      { itemId: "whip", locationId: "loc-van", onHand: 1, minQty: null, maxQty: null },
    ]);
    const result = await postTechVanCount(
      "tech-1",
      "van-1",
      [
        { itemId: "cap", countedQty: 3 },
        { itemId: "whip", countedQty: 1 },
      ],
      null,
    );
    expect(result).toEqual({ posted: 1, skipped: 1, noChange: false });
    const entries = m.postMyVanEntries.mock.calls[0][0];
    expect(entries).toEqual([
      { txn_type: "count", location_id: "loc-van", item_id: "cap", counted_qty: 3, reason: "Recount" },
    ]);
    expect(JSON.stringify(entries)).not.toMatch(/unit_cost|job_id|adjust/);
    expect(m.appendLedgerRows).not.toHaveBeenCalled();
    expect(m.listTransactions).not.toHaveBeenCalled();
    expect(m.listCountedLocationIds).not.toHaveBeenCalled();
  });

  it("does not post when nothing changed", async () => {
    const result = await postTechVanCount("tech-1", null, [{ itemId: "cap", countedQty: 1 }], null);
    expect(result.noChange).toBe(true);
    expect(m.postMyVanEntries).not.toHaveBeenCalled();
  });

  it("refuses another van and a recount before the office count-in", async () => {
    await expect(postTechVanCount("tech-1", "van-2", [{ itemId: "cap", countedQty: 1 }], null)).rejects.toMatchObject({
      status: 403,
    });
    m.listMyVanActivity.mockResolvedValue([]);
    await expect(postTechVanCount("tech-1", "van-1", [{ itemId: "cap", countedQty: 4 }], null)).rejects.toMatchObject({
      status: 400,
    });
    expect(m.postMyVanEntries).not.toHaveBeenCalled();
  });
});

describe("postTechVanRestock", () => {
  it("posts a shop-to-own-van pair for a below-par line", async () => {
    const result = await postTechVanRestock("tech-1", "van-1", [{ itemId: "cap", qty: 2 }]);
    expect(result).toEqual({ posted: 1 });
    expect(m.postMyVanEntries).toHaveBeenCalledWith([
      { txn_type: "transfer_out", location_id: "loc-shop", item_id: "cap", qty: 2, reason: "Restock" },
      { txn_type: "transfer_in", location_id: "loc-van", item_id: "cap", qty: 2, reason: "Restock" },
    ]);
    expect(m.appendLedgerRows).not.toHaveBeenCalled();
    expect(m.listTransactions).not.toHaveBeenCalled();
  });

  it("refuses a line that is not below par and a pull before count-in", async () => {
    m.listStockLevels.mockResolvedValue([{ itemId: "cap", locationId: "loc-van", onHand: 2, minQty: 2, maxQty: 4 }]);
    await expect(postTechVanRestock("tech-1", "van-1", [{ itemId: "cap", qty: 1 }])).rejects.toMatchObject({ status: 400 });
    m.listStockLevels.mockResolvedValue([{ itemId: "cap", locationId: "loc-van", onHand: 0, minQty: 2, maxQty: null }]);
    m.listMyVanActivity.mockResolvedValue([]);
    await expect(postTechVanRestock("tech-1", "van-1", [{ itemId: "cap", qty: 1 }])).rejects.toMatchObject({ status: 400 });
    expect(m.postMyVanEntries).not.toHaveBeenCalled();
  });
});
