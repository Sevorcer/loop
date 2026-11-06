import { describe, expect, it } from "vitest";

import { parseParBody } from "../utils/parPayload";
import {
  awaitingCountCopy,
  buildRestockList,
  isBelowPar,
  parInputProblem,
  resolveShopLocation,
  restockOmitCopy,
  shopIsShort,
  suggestedRestockQty,
  type RestockItemInput,
  type RestockLevelInput,
  type RestockVanInput,
} from "../utils/parRules";

describe("isBelowPar", () => {
  it("flags only when on-hand is under a minimum", () => {
    expect(isBelowPar(1, 2)).toBe(true);
    expect(isBelowPar(2, 2)).toBe(false);
    expect(isBelowPar(0, 1)).toBe(true);
    expect(isBelowPar(0, 0)).toBe(false);
    expect(isBelowPar(-1, 1)).toBe(true);
    expect(isBelowPar(0, null)).toBe(false);
    expect(isBelowPar(-3, null)).toBe(false);
  });
});

describe("suggestedRestockQty", () => {
  it("fills to the maximum, or to the minimum when fill-to is blank", () => {
    expect(suggestedRestockQty(1, 2, 4)).toBe(3);
    expect(suggestedRestockQty(0, 2, null)).toBe(2);
    expect(suggestedRestockQty(-1, 2, 4)).toBe(5);
    expect(suggestedRestockQty(4, 2, 4)).toBe(0);
    expect(suggestedRestockQty(5, 2, 4)).toBe(0);
    expect(suggestedRestockQty(3, null, 8)).toBe(0);
    expect(suggestedRestockQty(0.5, 2, null)).toBe(1.5);
  });

  it("treats the shop as short only when the suggestion exceeds shop on-hand", () => {
    expect(shopIsShort(1, 4)).toBe(true);
    expect(shopIsShort(4, 4)).toBe(false);
    expect(shopIsShort(0, 0)).toBe(false);
  });
});

describe("par input copy", () => {
  it("accepts a blank and rejects a bad number or a fill-to under the minimum", () => {
    expect(parInputProblem("", "")).toBeNull();
    expect(parInputProblem("2", "4")).toBeNull();
    expect(parInputProblem("2", "")).toBeNull();
    expect(parInputProblem("4", "2")).toBe("Fill to can't be less than the minimum.");
    expect(parInputProblem("abc", "1")).toBe("Use a number, or leave it blank.");
    expect(parInputProblem("-1", "")).toBe("Use a number, or leave it blank.");
    expect(parInputProblem("1.2345", "")).toBe("Use a number, or leave it blank.");
  });
});

describe("resolveShopLocation", () => {
  const locations = [
    { id: "shop", type: "warehouse", isActive: true, name: "Shop warehouse" },
    { id: "closed", type: "warehouse", isActive: false, name: "Old shop" },
    { id: "rma", type: "quarantine", isActive: true, name: "Quarantine" },
  ];

  it("uses an active warehouse parent", () => {
    expect(resolveShopLocation({ parentLocationId: "shop" }, locations)?.id).toBe("shop");
  });

  it("falls through to the only active warehouse when the parent is not one", () => {
    expect(resolveShopLocation({ parentLocationId: "rma" }, locations)?.id).toBe("shop");
    expect(resolveShopLocation({ parentLocationId: "closed" }, locations)?.id).toBe("shop");
    expect(resolveShopLocation({ parentLocationId: null }, locations)?.id).toBe("shop");
  });

  it("stays unresolved when several warehouses could be the source", () => {
    const two = [...locations, { id: "shop-2", type: "warehouse", isActive: true, name: "South" }];
    expect(resolveShopLocation({ parentLocationId: null }, two)).toBeNull();
    expect(resolveShopLocation({ parentLocationId: "shop" }, two)?.id).toBe("shop");
  });
});

const capacitor: RestockItemInput = {
  id: "cap",
  name: "Capacitor",
  sku: "CAP-2",
  unit: "ea",
  isActive: true,
  isStockable: true,
};
const filter: RestockItemInput = {
  id: "filter",
  name: "Filter",
  sku: null,
  unit: "ea",
  isActive: true,
  isStockable: true,
};
const retiredItem: RestockItemInput = {
  id: "old",
  name: "Old part",
  sku: null,
  unit: null,
  isActive: false,
  isStockable: true,
};
const service: RestockItemInput = {
  id: "call",
  name: "Service call",
  sku: null,
  unit: null,
  isActive: true,
  isStockable: false,
};

function van(over: Partial<RestockVanInput> & Pick<RestockVanInput, "vehicleId" | "vehicleName">): RestockVanInput {
  return {
    vehicleActive: true,
    locationId: `${over.vehicleId}-loc`,
    locationActive: true,
    counted: true,
    shopLocationId: "shop",
    shopLocationName: "Shop warehouse",
    ...over,
  };
}

function level(
  itemId: string,
  locationId: string,
  onHand: number,
  minQty: number | null,
  maxQty: number | null = null,
): RestockLevelInput {
  return { itemId, locationId, onHand, minQty, maxQty };
}

describe("buildRestockList", () => {
  const items = [capacitor, filter, retiredItem, service];

  it("keeps uncounted vans and vans with no pars off the list", () => {
    const list = buildRestockList(
      [
        van({ vehicleId: "v1", vehicleName: "Van 1", counted: false }),
        van({ vehicleId: "v2", vehicleName: "Van 2", counted: true }),
      ],
      items,
      [level("cap", "v2-loc", 0, null)],
    );
    expect(list.groups).toEqual([]);
    expect(list.awaitingCount).toBe(1);
    expect(list.omitted.map((row) => row.reason)).toEqual(["not_counted", "no_pars"]);
    expect(awaitingCountCopy(1)).toContain("1 van is waiting");
    expect(awaitingCountCopy(2)).toContain("2 vans");
    expect(restockOmitCopy("not_counted", "Van 1")).toContain("counted in");
  });

  it("suggests fill-to minus on-hand and leaves a van that is exactly on minimum off the list", () => {
    const list = buildRestockList(
      [van({ vehicleId: "v1", vehicleName: "Van 1" })],
      items,
      [
        level("cap", "v1-loc", 1, 2, 4),
        level("filter", "v1-loc", 3, 3, 6),
        level("cap", "shop", 1, null),
        level("old", "v1-loc", 0, 5, 5),
        level("call", "v1-loc", 0, 1, 1),
      ],
    );
    expect(list.groups).toHaveLength(1);
    expect(list.groups[0].lines.map((line) => line.itemId)).toEqual(["cap"]);
    expect(list.groups[0].lines[0]).toMatchObject({
      onHand: 1,
      minQty: 2,
      maxQty: 4,
      suggestedQty: 3,
      shopOnHand: 1,
      shopShort: true,
      negative: false,
    });
  });

  it("counts a missing stock row as zero after the count-in, and warns when the shop is short", () => {
    const list = buildRestockList(
      [van({ vehicleId: "v1", vehicleName: "Van 1" })],
      items,
      [level("cap", "v1-loc", 0, 2, null)],
    );
    expect(list.groups[0].lines[0]).toMatchObject({ suggestedQty: 2, shopOnHand: 0, shopShort: true });
  });

  it("drops inactive vans and vans with no location, and does not count them as waiting", () => {
    const list = buildRestockList(
      [
        van({ vehicleId: "v1", vehicleName: "Retired", vehicleActive: false, counted: false }),
        van({ vehicleId: "v2", vehicleName: "No location", locationId: null, counted: false }),
      ],
      items,
      [],
    );
    expect(list.awaitingCount).toBe(0);
    expect(list.omitted.map((row) => row.reason)).toEqual(["no_location", "inactive"]);
  });

  it("includes negative on-hand and leaves the shop blank when it cannot be resolved", () => {
    const list = buildRestockList(
      [van({ vehicleId: "v1", vehicleName: "Van 1", shopLocationId: null, shopLocationName: null })],
      items,
      [level("cap", "v1-loc", -1, 2, 4)],
    );
    expect(list.groups[0].lines[0]).toMatchObject({
      suggestedQty: 5,
      shopOnHand: null,
      shopShort: false,
      negative: true,
    });
  });
});

describe("parseParBody", () => {
  it("keeps only valid dirty rows", () => {
    const parsed = parseParBody({
      locationId: "loc-1",
      rows: [
        { itemId: "a", minQty: 2, maxQty: 4 },
        { itemId: "b", minQty: null, maxQty: null },
      ],
    });
    expect(parsed.problems).toEqual([]);
    expect(parsed.rows).toEqual([
      { itemId: "a", minQty: 2, maxQty: 4 },
      { itemId: "b", minQty: null, maxQty: null },
    ]);
  });

  it("rejects a fill-to under the minimum and a missing location", () => {
    const parsed = parseParBody({ rows: [{ itemId: "a", minQty: 4, maxQty: 1 }] });
    expect(parsed.problems).toContain("locationId is required.");
    expect(parsed.problems).toContain("Fill to can't be less than the minimum.");
  });
});
