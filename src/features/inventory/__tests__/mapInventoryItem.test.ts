import { describe, expect, it } from "vitest";

import { isMissingInventoryTable, mapInventoryItem } from "../utils/mapInventoryItem";

describe("inventory rows", () => {
  it("maps a database row without inventing stock", () => {
    expect(
      mapInventoryItem({
        id: "item-1",
        name: "Filter",
        sku: "FLT-1",
        quantity_on_hand: 4,
        quantity_reserved: 1,
      }),
    ).toMatchObject({
      id: "item-1",
      name: "Filter",
      quantityOnHand: 4,
      quantityReserved: 1,
      quantityAvailable: 3,
      isBackordered: false,
    });
  });

  it("drops rows that have no name", () => {
    expect(mapInventoryItem({ id: "item-1" })).toBeNull();
  });

  it("recognizes a missing inventory table", () => {
    expect(isMissingInventoryTable("Could not find the table 'public.inventory_items' in the schema cache")).toBe(true);
    expect(isMissingInventoryTable("permission denied")).toBe(false);
  });
});
