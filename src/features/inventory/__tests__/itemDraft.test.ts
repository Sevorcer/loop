import { describe, expect, it } from "vitest";

import { emptyItemDraft, itemDraftToPayload, tiersToPayload } from "../utils/itemDraft";

describe("itemDraftToPayload", () => {
  it("builds a stockable item payload with cost only when allowed", () => {
    const draft = { ...emptyItemDraft(), name: " 20A breaker ", sku: "BR-20", unitCost: "4.25" };
    const withCost = itemDraftToPayload(draft, { includeCost: true });
    expect(withCost.ok).toBe(true);
    if (withCost.ok) {
      expect(withCost.payload.cost).toEqual({ unitCostCents: 425, preferredVendor: null });
      expect(withCost.payload.isSellable).toBe(false);
    }
    const noCost = itemDraftToPayload(draft, { includeCost: false });
    expect(noCost.ok && "cost" in noCost.payload).toBe(false);
  });
  it("requires a sell price for sellable items and a unit for stockable items", () => {
    const sellable = itemDraftToPayload({ ...emptyItemDraft(), name: "Tune-up", isSellable: true, isStockable: false }, { includeCost: false });
    expect(sellable.ok).toBe(false);
    const noUnit = itemDraftToPayload({ ...emptyItemDraft(), name: "Wire", unit: "" }, { includeCost: false });
    expect(noUnit.ok).toBe(false);
  });
  it("rejects bad dollars and drops sell fields for non-sellable items", () => {
    expect(itemDraftToPayload({ ...emptyItemDraft(), name: "x", isSellable: true, sellPrice: "abc" }, { includeCost: false }).ok).toBe(false);
    const ok = itemDraftToPayload({ ...emptyItemDraft(), name: "x", sellPrice: "10" }, { includeCost: false });
    expect(ok.ok && ok.payload.sellPriceCents).toBeNull();
  });
});

describe("tiersToPayload", () => {
  it("converts, orders and validates tiers", () => {
    const ok = tiersToPayload([
      { key: "1", label: "Good", price: "4500", memberPrice: "4200" },
      { key: "2", label: "Better", price: "5200.50", memberPrice: "" },
    ]);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.tiers[1]).toEqual({ label: "Better", priceCents: 520050, memberPriceCents: null, sortOrder: 1 });
    }
  });
  it("rejects empty, duplicate and unpriced tiers", () => {
    expect(tiersToPayload([]).ok).toBe(false);
    expect(tiersToPayload([{ key: "1", label: "A", price: "1", memberPrice: "" }, { key: "2", label: "a", price: "2", memberPrice: "" }]).ok).toBe(false);
    expect(tiersToPayload([{ key: "1", label: "A", price: "", memberPrice: "" }]).ok).toBe(false);
  });
});
