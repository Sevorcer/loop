import { describe, expect, it } from "vitest";

import {
  buildMyVanActivity,
  buildMyVanCards,
  buildMyVanPickLines,
  describeVanActivity,
  filterMyVanCards,
  locationWasCounted,
  myVanSignals,
  orderMyVanAssignments,
  pickMyVanAssignment,
  resolvePostAssignment,
  showRecountSection,
  showRestockSection,
} from "../utils/myVanView";

const capacitor = {
  id: "cap",
  name: "Capacitor",
  sku: "CAP-45",
  unit: "ea",
  brand: "Supco",
  isActive: true,
  isStockable: true,
};

const contactor = {
  id: "con",
  name: "Contactor",
  sku: null,
  unit: "ea",
  brand: null,
  isActive: true,
  isStockable: true,
};

describe("pickMyVanAssignment", () => {
  const rows = [
    { vehicleId: "b", isHome: false, name: "Van B" },
    { vehicleId: "a", isHome: true, name: "Van A" },
  ];

  it("opens the home van first", () => {
    expect(orderMyVanAssignments(rows).map((row) => row.vehicleId)).toEqual(["a", "b"]);
    expect(pickMyVanAssignment(rows, null)?.vehicleId).toBe("a");
  });

  it("opens another assigned van when asked, and ignores an id that is not assigned", () => {
    expect(pickMyVanAssignment(rows, "b")?.vehicleId).toBe("b");
    expect(pickMyVanAssignment(rows, "someone-else")?.vehicleId).toBe("a");
    expect(pickMyVanAssignment([], "a")).toBeNull();
  });

  it("refuses a post to a van the person is not assigned to", () => {
    expect(resolvePostAssignment(rows, "b").ok).toBe(true);
    const refused = resolvePostAssignment(rows, "other");
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.status).toBe(403);
    const none = resolvePostAssignment([], null);
    expect(none.ok).toBe(false);
  });
});

describe("my van signals", () => {
  it("hides below-par until the van has been counted, and exact-on-min is not low", () => {
    expect(myVanSignals({ counted: false, onHand: 0, minQty: 4 }).belowPar).toBe(false);
    expect(myVanSignals({ counted: true, onHand: 4, minQty: 4 }).belowPar).toBe(false);
    expect(myVanSignals({ counted: true, onHand: 3, minQty: 4 }).belowPar).toBe(true);
    expect(myVanSignals({ counted: true, onHand: -1, minQty: null }).negative).toBe(true);
    expect(showRestockSection({ open: true, counted: false, hasPar: true })).toBe(false);
    expect(showRestockSection({ open: true, counted: true, hasPar: false })).toBe(false);
    expect(showRestockSection({ open: false, counted: true, hasPar: true })).toBe(false);
    expect(showRecountSection({ open: true, counted: false })).toBe(false);
    expect(showRecountSection({ open: true, counted: true })).toBe(true);
  });

  it("keeps shop quantity off the truck cards and on the pick lines only", () => {
    const cards = buildMyVanCards(
      [capacitor, contactor],
      [
        { itemId: "cap", onHand: 1, minQty: 4 },
        { itemId: "con", onHand: 4, minQty: 4 },
      ],
      true,
    );
    expect(cards.map((card) => card.name)).toEqual(["Capacitor", "Contactor"]);
    expect(cards[0]?.belowPar).toBe(true);
    expect(cards[1]?.belowPar).toBe(false);
    for (const card of cards) {
      expect(card).not.toHaveProperty("shopOnHand");
      expect(card).not.toHaveProperty("unitCostCents");
      expect(card).not.toHaveProperty("sellPriceCents");
    }

    const hidden = buildMyVanCards([capacitor], [{ itemId: "cap", onHand: 0, minQty: 4 }], false);
    expect(hidden[0]?.belowPar).toBe(false);

    const lines = buildMyVanPickLines({
      open: true,
      counted: true,
      vehicleId: "van",
      vehicleName: "Van A",
      locationId: "loc-van",
      shopLocationId: "loc-shop",
      shopLocationName: "Shop warehouse",
      items: [
        { id: "cap", name: "Capacitor", sku: "CAP-45", unit: "ea", isActive: true, isStockable: true },
        { id: "con", name: "Contactor", sku: null, unit: "ea", isActive: true, isStockable: true },
      ],
      levels: [
        { itemId: "cap", locationId: "loc-van", onHand: 1, minQty: 2, maxQty: 4 },
        { itemId: "con", locationId: "loc-van", onHand: 4, minQty: 4, maxQty: null },
        { itemId: "cap", locationId: "loc-shop", onHand: 1, minQty: null, maxQty: null },
        { itemId: "other", locationId: "loc-other-van", onHand: 9, minQty: 1, maxQty: null },
      ],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ itemId: "cap", suggestedQty: 3, shopOnHand: 1, shopShort: true });
    expect(lines[0]).not.toHaveProperty("unitCostCents");

    expect(
      buildMyVanPickLines({
        open: true,
        counted: false,
        vehicleId: "van",
        vehicleName: "Van A",
        locationId: "loc-van",
        shopLocationId: "loc-shop",
        shopLocationName: "Shop warehouse",
        items: [{ id: "cap", name: "Capacitor", sku: null, unit: "ea", isActive: true, isStockable: true }],
        levels: [{ itemId: "cap", locationId: "loc-van", onHand: 0, minQty: 2, maxQty: null }],
      }),
    ).toEqual([]);
  });

  it("filters cards by name without exposing another field", () => {
    const cards = buildMyVanCards([capacitor, contactor], [], true);
    expect(filterMyVanCards(cards, "supco").map((card) => card.itemId)).toEqual(["cap"]);
  });
});

describe("van activity", () => {
  it("treats a count row as the count-in and describes restock without cost", () => {
    expect(locationWasCounted([{ locationId: "loc", txnType: "transfer_in" }], "loc")).toBe(false);
    expect(locationWasCounted([{ locationId: "loc", txnType: "count" }], "loc")).toBe(true);
    expect(locationWasCounted([{ locationId: "other", txnType: "count" }], "loc")).toBe(false);

    expect(describeVanActivity({ txnType: "count", reason: "Recount", qtyDelta: -1 })).toEqual({
      label: "Counted",
      quantity: "-1",
    });
    expect(describeVanActivity({ txnType: "transfer_in", reason: "Restock", qtyDelta: 2 })).toEqual({
      label: "Restock from shop",
      quantity: "+2",
    });
    const shown = buildMyVanActivity(
      [
        {
          id: "1",
          txnType: "transfer_in",
          itemId: "cap",
          locationId: "loc",
          qtyDelta: 2,
          reason: "Restock",
          createdAt: "2026-11-06T16:00:00.000Z",
        },
        {
          id: "2",
          txnType: "count",
          itemId: "cap",
          locationId: "other",
          qtyDelta: 1,
          reason: "Recount",
          createdAt: "2026-11-06T15:00:00.000Z",
        },
      ],
      "loc",
      new Map([["cap", "Capacitor"]]),
    );
    expect(shown).toHaveLength(1);
    expect(shown[0]?.label).toBe("Restock from shop");
    expect(shown[0]?.itemName).toBe("Capacitor");
    expect(JSON.stringify(shown)).not.toMatch(/cost|\$|job/i);
  });
});
