import { describe, expect, it } from "vitest";

import type { CatalogCategory, CatalogItem } from "../types/catalog";
import { categoryAndDescendantIds, countItemsByCategory, filterCatalogItems, flattenCategoryTree, parseCatalogFacet } from "../utils/catalogView";

const cats: CatalogCategory[] = [
  { id: "b", parentId: "a", name: "Breakers", sortOrder: 0, isActive: true },
  { id: "a", parentId: null, name: "Electrical", sortOrder: 1, isActive: true },
  { id: "h", parentId: null, name: "HVAC", sortOrder: 0, isActive: true },
  { id: "x", parentId: "gone", name: "Orphan", sortOrder: 5, isActive: true },
];

function item(over: Partial<CatalogItem> & { id: string; name: string }): CatalogItem {
  return {
    categoryId: null, description: null, itemKind: "product", isSellable: false, sellPriceCents: null,
    memberPriceCents: null, isTaxable: true, isStockable: false, sku: null, unit: null, trackingMode: "quantity",
    brand: null, model: null, mfrPartNumber: null, sizeAttrs: {}, isActive: true, createdAt: "", updatedAt: "", ...over,
  };
}

describe("flattenCategoryTree", () => {
  it("orders depth-first by sortOrder then name with depths", () => {
    expect(flattenCategoryTree(cats).map((c) => [c.id, c.depth])).toEqual([["h", 0], ["a", 0], ["b", 1], ["x", 0]]);
  });
  it("survives a loop", () => {
    const loop: CatalogCategory[] = [
      { id: "p", parentId: "q", name: "P", sortOrder: 0, isActive: true },
      { id: "q", parentId: "p", name: "Q", sortOrder: 0, isActive: true },
    ];
    expect(flattenCategoryTree(loop)).toHaveLength(0);
  });
});

describe("categoryAndDescendantIds", () => {
  it("includes descendants", () => {
    expect([...categoryAndDescendantIds("a", cats)].sort()).toEqual(["a", "b"]);
  });
});

describe("filterCatalogItems", () => {
  const items = [
    item({ id: "1", name: "Condenser", isSellable: true, isStockable: true, categoryId: "h" }),
    item({ id: "2", name: "Labor hour", isSellable: true }),
    item({ id: "3", name: "20A breaker", isStockable: true, categoryId: "b", sku: "BR-20" }),
    item({ id: "4", name: "Retired", isStockable: true, isActive: false }),
  ];
  it("applies facets", () => {
    expect(filterCatalogItems(items, cats, { facet: "sellable" }).map((i) => i.id)).toEqual(["1", "2"]);
    expect(filterCatalogItems(items, cats, { facet: "stockable" }).map((i) => i.id)).toEqual(["1", "3"]);
    expect(filterCatalogItems(items, cats, { facet: "both" }).map((i) => i.id)).toEqual(["1"]);
    expect(filterCatalogItems(items, cats, { facet: "inactive" }).map((i) => i.id)).toEqual(["4"]);
  });
  it("hides inactive by default", () => {
    expect(filterCatalogItems(items, cats, {}).map((i) => i.id)).toEqual(["1", "2", "3"]);
  });
  it("filters by category subtree and search", () => {
    expect(filterCatalogItems(items, cats, { categoryId: "a" }).map((i) => i.id)).toEqual(["3"]);
    expect(filterCatalogItems(items, cats, { search: "br-20" }).map((i) => i.id)).toEqual(["3"]);
  });
  it("counts active items per category and parses facets", () => {
    expect(countItemsByCategory(items).get("b")).toBe(1);
    expect(parseCatalogFacet("both")).toBe("both");
    expect(parseCatalogFacet("zzz")).toBe("all");
  });
});

import { buildCatalogHref } from "../utils/catalogView";

describe("buildCatalogHref", () => {
  it("keeps other filters and drops empties", () => {
    expect(buildCatalogHref("/c", { q: "x", facet: "both" }, { category: "a" })).toBe("/c?q=x&facet=both&category=a");
    expect(buildCatalogHref("/c", { q: "x", category: "a" }, { category: null })).toBe("/c?q=x");
    expect(buildCatalogHref("/c", {}, {})).toBe("/c");
  });
});
