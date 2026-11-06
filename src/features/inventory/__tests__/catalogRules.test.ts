import { describe, expect, it } from "vitest";

import type { CatalogItemInput } from "../types/catalog";
import {
  findDuplicateTierLabel,
  normalizeCatalogItemInput,
  validateCatalogItemInput,
  validatePriceTierInput,
} from "../utils/catalogRules";

const product: CatalogItemInput = {
  name: "Condensate pump",
  itemKind: "product",
  isSellable: true,
  sellPriceCents: 18900,
  isStockable: true,
  sku: "CP-115",
  unit: "ea",
};

describe("validateCatalogItemInput", () => {
  it("accepts a product that is both sellable and stockable", () => {
    expect(validateCatalogItemInput(product)).toEqual([]);
  });

  it("accepts a sell-only service and a stock-only consumable", () => {
    expect(
      validateCatalogItemInput({ name: "Diagnostic", itemKind: "service", isSellable: true, sellPriceCents: 9900, isStockable: false }),
    ).toEqual([]);
    expect(
      validateCatalogItemInput({ name: "Wire nuts", itemKind: "consumable", isSellable: false, isStockable: true, unit: "box" }),
    ).toEqual([]);
  });

  it("requires at least one facet", () => {
    expect(validateCatalogItemInput({ name: "Ghost", itemKind: "product", isSellable: false, isStockable: false })).toContain(
      "An item must be sellable, stockable, or both.",
    );
  });

  it("requires a price for sellable items and whole-cent amounts", () => {
    expect(validateCatalogItemInput({ ...product, sellPriceCents: null })).toHaveLength(1);
    expect(validateCatalogItemInput({ ...product, sellPriceCents: 12.5 }).length).toBeGreaterThan(0);
    expect(validateCatalogItemInput({ ...product, memberPriceCents: -1 }).length).toBeGreaterThan(0);
  });

  it("never lets services or labor be stocked", () => {
    expect(validateCatalogItemInput({ ...product, itemKind: "service" })).toContain("Services and labor cannot be stocked.");
    expect(validateCatalogItemInput({ ...product, itemKind: "labor" })).toContain("Services and labor cannot be stocked.");
  });

  it("requires a unit for stockable items and a stockable item for serialization", () => {
    expect(validateCatalogItemInput({ ...product, unit: " " }).length).toBeGreaterThan(0);
    expect(
      validateCatalogItemInput({ name: "Install", itemKind: "service", isSellable: true, sellPriceCents: 1, isStockable: false, trackingMode: "serialized" }),
    ).toContain("Only stockable items can be serialized.");
  });

  it("rejects a blank name and a blank-but-present sku", () => {
    expect(validateCatalogItemInput({ ...product, name: "  " })).toContain("name is required.");
    expect(validateCatalogItemInput({ ...product, sku: "   " })).toContain("sku cannot be blank.");
  });
});

describe("normalizeCatalogItemInput", () => {
  it("trims text, defaults taxable/tracking/active, and nulls empty strings", () => {
    const out = normalizeCatalogItemInput({ ...product, name: "  Condensate pump ", sku: " CP-115 ", brand: "  ", description: "" });
    expect(out.name).toBe("Condensate pump");
    expect(out.sku).toBe("CP-115");
    expect(out.brand).toBeNull();
    expect(out.description).toBeNull();
    expect(out.isTaxable).toBe(true);
    expect(out.trackingMode).toBe("quantity");
    expect(out.isActive).toBe(true);
  });

  it("drops stock-facet fields for sell-only items and price fields for stock-only items", () => {
    const sellOnly = normalizeCatalogItemInput({ name: "Tune-up", itemKind: "service", isSellable: true, sellPriceCents: 12900, isStockable: false, sku: "X", unit: "ea" });
    expect(sellOnly.sku).toBeNull();
    expect(sellOnly.unit).toBeNull();

    const stockOnly = normalizeCatalogItemInput({ name: "Wire nuts", itemKind: "consumable", isSellable: false, sellPriceCents: 500, memberPriceCents: 400, isStockable: true, unit: "box" });
    expect(stockOnly.sellPriceCents).toBeNull();
    expect(stockOnly.memberPriceCents).toBeNull();
  });
});

describe("price tiers", () => {
  it("validates label and cents", () => {
    expect(validatePriceTierInput({ label: "Standard", priceCents: 12900 })).toEqual([]);
    expect(validatePriceTierInput({ label: " ", priceCents: 12900 }).length).toBeGreaterThan(0);
    expect(validatePriceTierInput({ label: "x", priceCents: 1.5 }).length).toBeGreaterThan(0);
  });

  it("finds duplicate labels case-insensitively", () => {
    expect(findDuplicateTierLabel([{ label: "Standard", priceCents: 1 }, { label: " standard ", priceCents: 2 }])).toBe("standard");
    expect(findDuplicateTierLabel([{ label: "Standard", priceCents: 1 }, { label: "After-hours", priceCents: 2 }])).toBeNull();
  });
});
