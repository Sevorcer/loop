/** Pure view logic for the Catalog screen: category tree, facets, search. */

import type { CatalogCategory, CatalogItem } from "../types/catalog";
import { matchesItemSearch } from "./stockView";

export const CATALOG_FACETS = ["all", "sellable", "stockable", "both", "inactive"] as const;
export type CatalogFacet = (typeof CATALOG_FACETS)[number];

export function parseCatalogFacet(value: string | null | undefined): CatalogFacet {
  return CATALOG_FACETS.includes(value as CatalogFacet) ? (value as CatalogFacet) : "all";
}

export interface FlatCategory {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  isActive: boolean;
}

/** Depth-first flatten, siblings by sortOrder then name. Orphans and loops are surfaced as roots/skipped safely. */
export function flattenCategoryTree(categories: readonly CatalogCategory[]): FlatCategory[] {
  const ids = new Set(categories.map((category) => category.id));
  const children = new Map<string | null, CatalogCategory[]>();
  for (const category of categories) {
    const parent = category.parentId && ids.has(category.parentId) ? category.parentId : null;
    const list = children.get(parent);
    if (list) list.push(category);
    else children.set(parent, [category]);
  }
  const out: FlatCategory[] = [];
  const seen = new Set<string>();
  const visit = (parent: string | null, depth: number) => {
    const list = [...(children.get(parent) ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    for (const category of list) {
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      out.push({ id: category.id, name: category.name, parentId: category.parentId, depth, isActive: category.isActive });
      visit(category.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

/** The category plus all of its descendants. */
export function categoryAndDescendantIds(categoryId: string, categories: readonly CatalogCategory[]): Set<string> {
  const result = new Set<string>([categoryId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of categories) {
      if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
        result.add(category.id);
        grew = true;
      }
    }
  }
  return result;
}

export interface CatalogFilterInput {
  search?: string | null;
  facet?: CatalogFacet;
  categoryId?: string | null;
}

export function filterCatalogItems<T extends CatalogItem>(
  items: readonly T[],
  categories: readonly CatalogCategory[],
  filter: CatalogFilterInput,
): T[] {
  const facet = filter.facet ?? "all";
  const categoryIds = filter.categoryId ? categoryAndDescendantIds(filter.categoryId, categories) : null;
  return items.filter((item) => {
    if (facet === "inactive") {
      if (item.isActive) return false;
    } else if (!item.isActive) {
      return false;
    }
    if (facet === "sellable" && !item.isSellable) return false;
    if (facet === "stockable" && !item.isStockable) return false;
    if (facet === "both" && !(item.isSellable && item.isStockable)) return false;
    if (categoryIds && (!item.categoryId || !categoryIds.has(item.categoryId))) return false;
    return matchesItemSearch(item, filter.search);
  });
}

/** Number of (active) items directly in each category, for the sidebar counts. */
export function countItemsByCategory(items: readonly Pick<CatalogItem, "categoryId" | "isActive">[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.isActive || !item.categoryId) continue;
    counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
  }
  return counts;
}

export function describeFacets(item: Pick<CatalogItem, "isSellable" | "isStockable">): string {
  if (item.isSellable && item.isStockable) return "Sellable + stocked";
  if (item.isSellable) return "Sellable";
  if (item.isStockable) return "Stocked";
  return "Neither";
}

/** Href for the catalog with a modified set of filters (keeps the others). Empty values are dropped. */
export function buildCatalogHref(
  base: string,
  current: { q?: string | null; facet?: CatalogFacet; category?: string | null },
  patch: { q?: string | null; facet?: CatalogFacet; category?: string | null },
): string {
  const merged = { ...current, ...patch };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.facet && merged.facet !== "all") params.set("facet", merged.facet);
  if (merged.category) params.set("category", merged.category);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
