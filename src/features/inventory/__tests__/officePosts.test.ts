import { describe, expect, it } from "vitest";

import {
  expandOfficeCount,
  INITIAL_COUNT_REASON,
  OFFICE_RECOUNT_REASON,
  orderCountSheet,
  parseCountBody,
  resolveCountReason,
  type CountSheetItem,
} from "../utils/countSheet";
import { expandOfficeRestock, parseRestockBody, RESTOCK_REASON } from "../utils/restockPost";

function sheetItem(overrides: Partial<CountSheetItem> & Pick<CountSheetItem, "id" | "name">): CountSheetItem {
  return {
    sku: null,
    unit: "ea",
    onHand: 0,
    minQty: null,
    maxQty: null,
    ...overrides,
  };
}

describe("orderCountSheet", () => {
  it("lists items with a par before the rest, by name", () => {
    const ordered = orderCountSheet([
      sheetItem({ id: "z", name: "Zip tie" }),
      sheetItem({ id: "b", name: "Breaker", minQty: 2 }),
      sheetItem({ id: "a", name: "Capacitor", maxQty: 4 }),
      sheetItem({ id: "c", name: "Contactor" }),
    ]);
    expect(ordered.map((item) => item.name)).toEqual(["Breaker", "Capacitor", "Contactor", "Zip tie"]);
  });
});

describe("resolveCountReason", () => {
  it("defaults the first count and a later recount", () => {
    expect(resolveCountReason(null, false)).toBe(INITIAL_COUNT_REASON);
    expect(resolveCountReason("  ", true)).toBe(OFFICE_RECOUNT_REASON);
    expect(resolveCountReason("With Casey", false)).toBe("With Casey");
  });

  it("rejects a note that is too long", () => {
    expect(() => resolveCountReason("x".repeat(501), false)).toThrow(/500/);
  });
});

describe("parseCountBody", () => {
  it("keeps zeros and drops nothing the client already omitted", () => {
    const parsed = parseCountBody({
      lines: [
        { itemId: "a", countedQty: 0 },
        { itemId: "b", countedQty: 2.5 },
      ],
    });
    expect(parsed.problems).toEqual([]);
    expect(parsed.lines).toEqual([
      { itemId: "a", countedQty: 0 },
      { itemId: "b", countedQty: 2.5 },
    ]);
    expect(parsed.reason).toBeNull();
  });

  it("rejects a negative count, a duplicate, and an empty sheet", () => {
    expect(parseCountBody({ lines: [] }).problems.join(" ")).toMatch(/at least one/);
    expect(parseCountBody({ lines: [{ itemId: "a", countedQty: -1 }] }).problems.join(" ")).toMatch(/0 or more/);
    expect(
      parseCountBody({
        lines: [
          { itemId: "a", countedQty: 1 },
          { itemId: "a", countedQty: 2 },
        ],
      }).problems.join(" "),
    ).toMatch(/once/);
  });

  it("does not take a cost off the body", () => {
    const parsed = parseCountBody({
      lines: [{ itemId: "a", countedQty: 1, unitCostCents: 900 }],
      reason: "Initial count-in",
    });
    expect(parsed.lines[0]).toEqual({ itemId: "a", countedQty: 1 });
    expect(parsed).not.toHaveProperty("unitCostCents");
  });
});

describe("expandOfficeCount", () => {
  it("posts the delta for a changed line and skips a match", () => {
    const onHand = new Map([
      ["a", 0],
      ["b", 4],
    ]);
    const result = expandOfficeCount({
      locationId: "van",
      reason: INITIAL_COUNT_REASON,
      lines: [
        { itemId: "a", countedQty: 3 },
        { itemId: "b", countedQty: 4 },
        { itemId: "c", countedQty: 0 },
      ],
      onHandByItem: onHand,
    });
    expect(result.rows).toEqual([
      {
        txnType: "count",
        itemId: "a",
        locationId: "van",
        qtyDelta: 3,
        reason: INITIAL_COUNT_REASON,
      },
    ]);
    expect(result.skippedItemIds).toEqual(["b", "c"]);
    expect(result.rows.every((row) => row.unitCostCents == null)).toBe(true);
  });
});

describe("parseRestockBody", () => {
  it("accepts a shop-to-van line and ignores a client reason or cost", () => {
    const parsed = parseRestockBody({
      reason: "Not restock",
      unitCostCents: 400,
      lines: [{ itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 2, unitCostCents: 400 }],
    });
    expect(parsed.problems).toEqual([]);
    expect(parsed.lines).toEqual([{ itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 2 }]);
  });

  it("rejects zero, a duplicate onto the same van, and an empty pull", () => {
    expect(parseRestockBody({ lines: [] }).problems.join(" ")).toMatch(/at least one/);
    expect(parseRestockBody({ lines: [{ itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 0 }] }).problems.join(" ")).toMatch(
      /greater than zero/,
    );
    expect(
      parseRestockBody({
        lines: [
          { itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 1 },
          { itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 2 },
        ],
      }).problems.join(" "),
    ).toMatch(/once/);
  });
});

describe("expandOfficeRestock", () => {
  it("writes one transfer pair per line, each with its own group and no cost", () => {
    let n = 0;
    const rows = expandOfficeRestock(
      [
        { itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 2 },
        { itemId: "b", fromLocationId: "shop", toLocationId: "van", qty: 1 },
      ],
      () => `group-${++n}`,
    );
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      txnType: "transfer_out",
      locationId: "shop",
      qtyDelta: -2,
      transferGroupId: "group-1",
      reason: RESTOCK_REASON,
    });
    expect(rows[1]).toMatchObject({ txnType: "transfer_in", locationId: "van", qtyDelta: 2, transferGroupId: "group-1" });
    expect(rows[2].transferGroupId).toBe("group-2");
    expect(rows[3].transferGroupId).toBe("group-2");
    expect(new Set(rows.map((row) => row.transferGroupId)).size).toBe(2);
    expect(rows.every((row) => row.unitCostCents == null && !row.jobId)).toBe(true);
  });

  it("refuses a repeated transfer group", () => {
    expect(() =>
      expandOfficeRestock([{ itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 1 }], () => "same"),
    ).not.toThrow();
    expect(() =>
      expandOfficeRestock(
        [
          { itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 1 },
          { itemId: "b", fromLocationId: "shop", toLocationId: "van", qty: 1 },
        ],
        () => "same",
      ),
    ).toThrow(/own transfer group/);
  });
});
