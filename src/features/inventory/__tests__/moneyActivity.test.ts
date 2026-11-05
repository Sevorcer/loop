import { describe, expect, it } from "vitest";

import { canReverseEntry, formatQtyDelta, parseTxnType, reversedEntryIds } from "../utils/activityView";
import { activeInventoryTab } from "../utils/inventoryTabs";
import { centsToDollarsInput, formatCents, parseDollarsToCents } from "../utils/money";

describe("money", () => {
  it("formats cents", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(null)).toBe("—");
  });
  it("parses dollars", () => {
    expect(parseDollarsToCents("$1,200.5")).toBe(120050);
    expect(parseDollarsToCents("12")).toBe(1200);
    expect(parseDollarsToCents("  ")).toBeNull();
    expect(parseDollarsToCents("1.234")).toBeUndefined();
    expect(parseDollarsToCents("abc")).toBeUndefined();
    expect(centsToDollarsInput(1999)).toBe("19.99");
  });
});

describe("activity", () => {
  it("never offers reverse on a reversal or an already reversed entry", () => {
    const reversed = reversedEntryIds([{ reversesTransactionId: "t1" }, { reversesTransactionId: null }]);
    expect(canReverseEntry({ id: "t1", txnType: "receive" }, reversed)).toBe(false);
    expect(canReverseEntry({ id: "t2", txnType: "reversal" }, reversed)).toBe(false);
    expect(canReverseEntry({ id: "t3", txnType: "adjust" }, reversed)).toBe(true);
  });
  it("parses types and formats deltas", () => {
    expect(parseTxnType("receive")).toBe("receive");
    expect(parseTxnType("x")).toBeUndefined();
    expect(formatQtyDelta(3)).toBe("+3");
    expect(formatQtyDelta(-3)).toBe("-3");
  });
});

describe("inventory tabs", () => {
  it("resolves the active tab", () => {
    expect(activeInventoryTab("/inventory")).toBe("stock");
    expect(activeInventoryTab("/inventory/catalog/abc")).toBe("catalog");
    expect(activeInventoryTab("/inventory/locations")).toBe("locations");
    expect(activeInventoryTab("/inventory/activity")).toBe("activity");
    expect(activeInventoryTab("/jobs")).toBeNull();
  });
});

import { parseQuantity } from "../utils/quantity";
import { lookupOnHand } from "../utils/stockView";

describe("quantity", () => {
  it("parses quantities", () => {
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity("-2.5")).toBe(-2.5);
    expect(parseQuantity("1.2345")).toBeUndefined();
    expect(parseQuantity("")).toBeUndefined();
    expect(lookupOnHand([{ itemId: "a", locationId: "w", onHand: 4 }], "a", "w")).toBe(4);
    expect(lookupOnHand([], "a", "w")).toBe(0);
  });
});
