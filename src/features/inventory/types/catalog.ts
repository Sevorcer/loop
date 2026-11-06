/**
 * Catalog domain types — the ONE item master (Inventory Lane 1).
 *
 * An item is sellable (price / member price / rate tiers), stockable
 * (SKU / unit / tracking mode), or both. Cost is deliberately NOT on CatalogItem:
 * it lives in a separate table that tech, dispatch, sales and the portal can
 * never read, so it is attached only by the server for roles allowed to see it.
 */

export const ITEM_KINDS = [
  "product",
  "service",
  "labor",
  "equipment",
  "refrigerant",
  "consumable",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const TRACKING_MODES = ["quantity", "serialized"] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

/** Kinds that are never physically stocked. */
export const NON_STOCKABLE_KINDS: readonly ItemKind[] = ["service", "labor"];

export interface CatalogCategory {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogItem {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  itemKind: ItemKind;

  isSellable: boolean;
  sellPriceCents: number | null;
  memberPriceCents: number | null;
  isTaxable: boolean;

  isStockable: boolean;
  sku: string | null;
  unit: string | null;
  trackingMode: TrackingMode;
  brand: string | null;
  model: string | null;
  mfrPartNumber: string | null;
  sizeAttrs: Record<string, unknown>;

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Present only for roles allowed to read `catalog_item_costs`. */
export interface CatalogItemCost {
  itemId: string;
  unitCostCents: number;
  preferredVendor: string | null;
  costUpdatedAt: string;
}

export interface CatalogItemWithCost extends CatalogItem {
  /** `undefined` = this role may not see cost; `null` = may see it, none recorded. */
  cost?: CatalogItemCost | null;
}

export interface CatalogPriceTier {
  id: string;
  itemId: string;
  label: string;
  priceCents: number;
  memberPriceCents: number | null;
  sortOrder: number;
}

/** Writable fields of an item (create and update share this shape). */
export interface CatalogItemInput {
  name: string;
  description?: string | null;
  categoryId?: string | null;
  itemKind: ItemKind;
  isSellable: boolean;
  sellPriceCents?: number | null;
  memberPriceCents?: number | null;
  isTaxable?: boolean;
  isStockable: boolean;
  sku?: string | null;
  unit?: string | null;
  trackingMode?: TrackingMode;
  brand?: string | null;
  model?: string | null;
  mfrPartNumber?: string | null;
  sizeAttrs?: Record<string, unknown>;
  isActive?: boolean;
}

export interface CatalogPriceTierInput {
  label: string;
  priceCents: number;
  memberPriceCents?: number | null;
  sortOrder?: number;
}

export interface CatalogItemFilters {
  search?: string;
  categoryId?: string;
  facet?: "sellable" | "stockable" | "both";
  includeInactive?: boolean;
  limit?: number;
}
