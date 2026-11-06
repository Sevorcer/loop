import { describe, expect, it } from "vitest";

import {
  buildTechCountEntries,
  buildTechRestockEntries,
  parseTechCountBody,
  parseTechPullBody,
  techEntryLeak,
  TECH_RECOUNT_REASON,
} from "../utils/vanEntries";
import { RESTOCK_REASON } from "../utils/restockPost";

describe("tech van entry payloads", () => {
  it("posts a count only when the number differs, and never an adjust or a cost", () => {
    const built = buildTechCountEntries({
      locationId: "loc-van",
      reason: TECH_RECOUNT_REASON,
      lines: [
        { itemId: "cap", countedQty: 3 },
        { itemId: "whip", countedQty: 1 },
      ],
      onHandByItem: new Map([
        ["cap", 1],
        ["whip", 1],
      ]),
    });
    expect(built.skipped).toBe(1);
    expect(built.entries).toEqual([
      {
        txn_type: "count",
        location_id: "loc-van",
        item_id: "cap",
        counted_qty: 3,
        reason: TECH_RECOUNT_REASON,
      },
    ]);
    expect(built.entries.every((entry) => techEntryLeak(entry) == null)).toBe(true);
    expect(JSON.stringify(built.entries)).not.toMatch(/adjust|unit_cost|job_id|transfer_group/);
  });

  it("builds a shop-to-own-van pair and refuses to aim the transfer at the van as the source", () => {
    const entries = buildTechRestockEntries({
      shopLocationId: "loc-shop",
      vanLocationId: "loc-van",
      lines: [{ itemId: "cap", qty: 2 }],
    });
    expect(entries.map((entry) => entry.txn_type)).toEqual(["transfer_out", "transfer_in"]);
    expect(entries[0]).toMatchObject({ location_id: "loc-shop", qty: 2, reason: RESTOCK_REASON });
    expect(entries[1]).toMatchObject({ location_id: "loc-van", qty: 2, reason: RESTOCK_REASON });
    expect(entries.every((entry) => techEntryLeak(entry) == null)).toBe(true);
    expect(JSON.stringify(entries)).not.toMatch(/unit_cost_cents|job_id|transfer_group_id|created_by/);
    expect(() =>
      buildTechRestockEntries({
        shopLocationId: "loc-van",
        vanLocationId: "loc-van",
        lines: [{ itemId: "cap", qty: 1 }],
      }),
    ).toThrow(/shop/);
  });

  it("ignores a client location, cost, and adjust shape on the way in", () => {
    const count = parseTechCountBody({
      vehicleId: "van-1",
      txn_type: "adjust",
      unitCostCents: 900,
      lines: [{ itemId: "cap", countedQty: 2, locationId: "other-van", unitCostCents: 900 }],
    });
    expect(count.problems).toEqual([]);
    expect(count.lines).toEqual([{ itemId: "cap", countedQty: 2 }]);
    expect(count.lines[0]).not.toHaveProperty("unitCostCents");
    expect(count.lines[0]).not.toHaveProperty("locationId");

    const pull = parseTechPullBody({
      lines: [
        {
          itemId: "cap",
          qty: 1,
          fromLocationId: "other-van",
          toLocationId: "also-other",
          unitCostCents: 400,
          reason: "Adjust",
        },
      ],
    });
    expect(pull.problems).toEqual([]);
    expect(pull.lines).toEqual([{ itemId: "cap", qty: 1 }]);
    expect(JSON.stringify(pull.lines)).not.toMatch(/location|cost|adjust/i);
  });

  it("rejects a negative count and an empty pull", () => {
    expect(parseTechCountBody({ lines: [{ itemId: "cap", countedQty: -1 }] }).problems.join(" ")).toMatch(/0 or more/);
    expect(parseTechPullBody({ lines: [] }).problems.join(" ")).toMatch(/at least one/);
  });
});
