import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  getVehicle: vi.fn(),
  listVehicles: vi.fn(),
  getVanLocationForVehicle: vi.fn(),
  listLocations: vi.fn(),
  listItems: vi.fn(),
  getItem: vi.fn(),
  listStockLevels: vi.fn(),
  listCountedLocationIds: vi.fn(),
  appendLedgerRows: vi.fn(),
}));

vi.mock("@/repositories/vehicles", () => ({
  getVehicle: m.getVehicle,
  listVehicles: m.listVehicles,
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
}));

import { postOfficeRestock, postOfficeVanCount } from "@/services/inventoryOfficePosts";
import { INITIAL_COUNT_REASON, OFFICE_RECOUNT_REASON } from "@/features/inventory/utils/countSheet";
import { RESTOCK_REASON } from "@/features/inventory/utils/restockPost";

const capacitor = {
  id: "cap",
  name: "Capacitor",
  isStockable: true,
  isActive: true,
};

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.listItems.mockResolvedValue([capacitor]);
  m.getItem.mockResolvedValue(null);
  m.appendLedgerRows.mockResolvedValue([]);
  m.getVehicle.mockResolvedValue({ id: "van-1", name: "Van 1", status: "active" });
  m.getVanLocationForVehicle.mockResolvedValue({
    id: "loc-van",
    type: "van",
    name: "Van 1",
    vehicleId: "van-1",
    parentLocationId: "loc-shop",
    isActive: true,
  });
  m.listStockLevels.mockResolvedValue([{ itemId: "cap", locationId: "loc-van", onHand: 0, minQty: 2, maxQty: 4 }]);
  m.listCountedLocationIds.mockResolvedValue(new Set());
});

describe("postOfficeVanCount", () => {
  it("appends one count row and skips a line that matches on-hand", async () => {
    m.listItems.mockResolvedValue([
      capacitor,
      { id: "whip", name: "Whip", isStockable: true, isActive: true },
    ]);
    const result = await postOfficeVanCount(
      "van-1",
      [
        { itemId: "cap", countedQty: 3 },
        { itemId: "whip", countedQty: 0 },
      ],
      null,
      "user-1",
    );

    expect(result).toMatchObject({ posted: 1, skipped: 1, noChange: false, countedIn: true });
    expect(m.appendLedgerRows).toHaveBeenCalledTimes(1);
    const [rows, userId] = m.appendLedgerRows.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(rows).toEqual([
      expect.objectContaining({
        txnType: "count",
        itemId: "cap",
        locationId: "loc-van",
        qtyDelta: 3,
        reason: INITIAL_COUNT_REASON,
      }),
    ]);
    expect(rows[0].unitCostCents ?? null).toBeNull();
  });

  it("posts nothing when every count matches, so an uncounted van stays uncounted", async () => {
    const result = await postOfficeVanCount("van-1", [{ itemId: "cap", countedQty: 0 }], "  ", "user-1");
    expect(result).toEqual({ posted: 0, skipped: 1, noChange: true, countedIn: false });
    expect(m.appendLedgerRows).not.toHaveBeenCalled();
  });

  it("uses the recount note after a count-in already exists", async () => {
    m.listCountedLocationIds.mockResolvedValue(new Set(["loc-van"]));
    m.listStockLevels.mockResolvedValue([{ itemId: "cap", locationId: "loc-van", onHand: 3, minQty: 2, maxQty: 4 }]);
    await postOfficeVanCount("van-1", [{ itemId: "cap", countedQty: 2 }], null, "user-1");
    const [rows] = m.appendLedgerRows.mock.calls[0];
    expect(rows[0]).toMatchObject({ qtyDelta: -1, reason: OFFICE_RECOUNT_REASON });
  });

  it("does not append a duplicate item twice in one count", async () => {
    await expect(
      postOfficeVanCount(
        "van-1",
        [
          { itemId: "cap", countedQty: 2 },
          { itemId: "cap", countedQty: 3 },
        ],
        null,
        "user-1",
      ),
    ).rejects.toThrow(/once/);
    expect(m.appendLedgerRows).not.toHaveBeenCalled();
  });

  it("does not append when the van has no stock location", async () => {
    m.getVanLocationForVehicle.mockResolvedValue(null);
    await expect(postOfficeVanCount("van-1", [{ itemId: "cap", countedQty: 1 }], null, "user-1")).rejects.toThrow(/stock location/);
    expect(m.appendLedgerRows).not.toHaveBeenCalled();
  });
});

describe("postOfficeRestock", () => {
  const shop = { id: "loc-shop", type: "warehouse", name: "Shop warehouse", isActive: true, parentLocationId: null };
  const van = {
    id: "loc-van",
    type: "van",
    name: "Van 1",
    vehicleId: "van-1",
    parentLocationId: "loc-shop",
    isActive: true,
  };

  beforeEach(() => {
    m.listLocations.mockResolvedValue([shop, van]);
    m.listVehicles.mockResolvedValue([{ id: "van-1", name: "Van 1", status: "active" }]);
    m.listCountedLocationIds.mockResolvedValue(new Set(["loc-van"]));
  });

  it("appends one pair per line from the shop, with no cost", async () => {
    m.listItems.mockResolvedValue([
      capacitor,
      { id: "whip", name: "Whip", isStockable: true, isActive: true },
    ]);
    const result = await postOfficeRestock(
      [
        { itemId: "cap", fromLocationId: "loc-shop", toLocationId: "loc-van", qty: 2 },
        { itemId: "whip", fromLocationId: "loc-shop", toLocationId: "loc-van", qty: 1 },
      ],
      "user-1",
    );
    expect(result).toEqual({ posted: 2 });
    expect(m.appendLedgerRows).toHaveBeenCalledTimes(1);
    const [rows, userId] = m.appendLedgerRows.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(rows).toHaveLength(4);
    const groups = new Set(rows.map((row: { transferGroupId: string }) => row.transferGroupId));
    expect(groups.size).toBe(2);
    expect(rows.every((row: { reason: string; unitCostCents?: number | null; jobId?: string | null }) =>
      row.reason === RESTOCK_REASON && (row.unitCostCents ?? null) === null && !row.jobId,
    )).toBe(true);
    expect(rows.filter((row: { txnType: string }) => row.txnType === "transfer_out").map((row: { locationId: string }) => row.locationId)).toEqual([
      "loc-shop",
      "loc-shop",
    ]);
  });

  it("does not append before the count-in or from the wrong shop", async () => {
    m.listCountedLocationIds.mockResolvedValue(new Set());
    await expect(
      postOfficeRestock([{ itemId: "cap", fromLocationId: "loc-shop", toLocationId: "loc-van", qty: 1 }], "user-1"),
    ).rejects.toThrow(/counted in/);

    m.listCountedLocationIds.mockResolvedValue(new Set(["loc-van"]));
    await expect(
      postOfficeRestock([{ itemId: "cap", fromLocationId: "other", toLocationId: "loc-van", qty: 1 }], "user-1"),
    ).rejects.toThrow(/shop warehouse/);
    expect(m.appendLedgerRows).not.toHaveBeenCalled();
  });

  it("does not append the same item twice onto one van", async () => {
    await expect(
      postOfficeRestock(
        [
          { itemId: "cap", fromLocationId: "loc-shop", toLocationId: "loc-van", qty: 1 },
          { itemId: "cap", fromLocationId: "loc-shop", toLocationId: "loc-van", qty: 1 },
        ],
        "user-1",
      ),
    ).rejects.toThrow(/once/);
    expect(m.appendLedgerRows).not.toHaveBeenCalled();
  });

  it("does not append an inactive item", async () => {
    m.listItems.mockResolvedValue([{ ...capacitor, isActive: false }]);
    await expect(
      postOfficeRestock([{ itemId: "cap", fromLocationId: "loc-shop", toLocationId: "loc-van", qty: 1 }], "user-1"),
    ).rejects.toThrow(/inactive/);
    expect(m.appendLedgerRows).not.toHaveBeenCalled();
  });
});
