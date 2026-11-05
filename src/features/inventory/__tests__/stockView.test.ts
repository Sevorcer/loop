import { describe, expect, it } from "vitest";

import type { CatalogItem } from "../types/catalog";
import type { InventoryLocation, StockLevel } from "../types/ledger";
import {
  buildLocationOptions,
  buildStockRows,
  computeStockFlag,
  countFlags,
  groupStockByLocation,
  negativeOnHandWarning,
  projectedOnHand,
  resolveSelectedLocation,
} from "../utils/stockView";

function item(over: Partial<CatalogItem> & { id: string; name: string }): CatalogItem {
  return {
    categoryId: null, description: null, itemKind: "product", isSellable: false, sellPriceCents: null,
    memberPriceCents: null, isTaxable: true, isStockable: true, sku: null, unit: "ea", trackingMode: "quantity",
    brand: null, model: null, mfrPartNumber: null, sizeAttrs: {}, isActive: true, createdAt: "", updatedAt: "", ...over,
  };
}
function level(itemId: string, locationId: string, onHand: number, minQty: number | null = null): StockLevel {
  return { itemId, locationId, onHand, minQty, maxQty: null, updatedAt: "" };
}
function loc(over: Partial<InventoryLocation> & { id: string; type: InventoryLocation["type"]; name: string }): InventoryLocation {
  return { parentLocationId: null, vehicleId: null, jobId: null, address: null, isActive: true, ...over };
}

describe("computeStockFlag", () => {
  it("flags negative, zero and ok", () => {
    expect(computeStockFlag(-1)).toBe("negative");
    expect(computeStockFlag(0)).toBe("zero");
    expect(computeStockFlag(2)).toBe("ok");
  });
});

describe("buildStockRows", () => {
  const items = [
    item({ id: "a", name: "Zeta filter", sku: "F-1" }),
    item({ id: "b", name: "Alpha coil" }),
    item({ id: "c", name: "Service call", isStockable: false }),
    item({ id: "d", name: "Old part", isActive: false }),
  ];
  it("shows missing levels as zero, skips non-stockable and empty inactive, sorts problems first", () => {
    const rows = buildStockRows(items, [level("a", "w", -2)]);
    expect(rows.map((row) => row.itemId)).toEqual(["a", "b"]);
    expect(rows[0].flag).toBe("negative");
    expect(rows[1].flag).toBe("zero");
  });
  it("keeps an inactive item that still holds stock", () => {
    expect(buildStockRows(items, [level("d", "w", 3)]).map((row) => row.itemId)).toContain("d");
  });
  it("searches by name or sku", () => {
    expect(buildStockRows(items, [], "f-1").map((row) => row.itemId)).toEqual(["a"]);
  });
  it("marks below-minimum only when otherwise ok", () => {
    const rows = buildStockRows(items, [level("a", "w", 2, 5), level("b", "w", 9, 5)]);
    expect(rows.find((row) => row.itemId === "a")?.belowMin).toBe(true);
    expect(rows.find((row) => row.itemId === "b")?.belowMin).toBe(false);
  });
  it("counts flags", () => {
    expect(countFlags(buildStockRows(items, [level("a", "w", -1)]))).toEqual({ negative: 1, zero: 1 });
  });
});

describe("locations", () => {
  const locations = [
    loc({ id: "q", type: "quarantine", name: "RMA" }),
    loc({ id: "v1", type: "van", name: "Van 2", vehicleId: "veh1" }),
    loc({ id: "w", type: "warehouse", name: "Main" }),
    loc({ id: "j", type: "job", name: "Job 9" }),
    loc({ id: "off", type: "warehouse", name: "Closed", isActive: false }),
  ];
  const options = buildLocationOptions(locations);
  it("orders warehouse, van, quarantine and drops job/inactive", () => {
    expect(options.map((option) => option.id)).toEqual(["w", "v1", "q"]);
  });
  it("resolves the requested location or falls back to the warehouse", () => {
    expect(resolveSelectedLocation(options, "v1")).toBe("v1");
    expect(resolveSelectedLocation(options, "nope")).toBe("w");
    expect(resolveSelectedLocation([], null)).toBeNull();
  });
  it("groups levels by location", () => {
    const grouped = groupStockByLocation([level("a", "w", 1), level("b", "w", 2), level("a", "v1", 3)]);
    expect(grouped.get("w")).toHaveLength(2);
    expect(grouped.get("v1")).toHaveLength(1);
  });
});

describe("negative warning", () => {
  it("projects and warns without blocking", () => {
    expect(projectedOnHand(1, -3)).toBe(-2);
    expect(negativeOnHandWarning({ projected: 0 })).toBeNull();
    expect(negativeOnHandWarning({ itemName: "Coil", locationName: "Van 1", projected: -2 })).toContain("-2");
  });
});
