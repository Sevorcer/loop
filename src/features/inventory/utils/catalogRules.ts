/**
 * Pure catalog rules. These mirror the CHECK constraints on `catalog_items`
 * so callers get a clear 400 before the database says no.
 */

import {
  ITEM_KINDS,
  NON_STOCKABLE_KINDS,
  TRACKING_MODES,
  type CatalogItemInput,
  type CatalogPriceTierInput,
} from "../types/catalog";

function blank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Returns a list of human-readable problems; empty means valid. */
export function validateCatalogItemInput(input: CatalogItemInput): string[] {
  const problems: string[] = [];

  if (blank(input.name)) problems.push("name is required.");
  if (!ITEM_KINDS.includes(input.itemKind)) problems.push("itemKind is not valid.");
  if (!input.isSellable && !input.isStockable) {
    problems.push("An item must be sellable, stockable, or both.");
  }

  if (input.isSellable) {
    if (!isCents(input.sellPriceCents)) {
      problems.push("A sellable item needs a sell price (whole cents, 0 or more).");
    }
  }
  if (input.memberPriceCents != null && !isCents(input.memberPriceCents)) {
    problems.push("memberPriceCents must be whole cents, 0 or more.");
  }
  if (input.sellPriceCents != null && !isCents(input.sellPriceCents)) {
    problems.push("sellPriceCents must be whole cents, 0 or more.");
  }

  if (NON_STOCKABLE_KINDS.includes(input.itemKind) && input.isStockable) {
    problems.push("Services and labor cannot be stocked.");
  }
  if (input.isStockable && blank(input.unit)) {
    problems.push("A stockable item needs a unit (ea, ft, lb, box...).");
  }
  if (input.sku != null && blank(input.sku)) problems.push("sku cannot be blank.");

  const tracking = input.trackingMode ?? "quantity";
  if (!TRACKING_MODES.includes(tracking)) problems.push("trackingMode is not valid.");
  if (tracking === "serialized" && !input.isStockable) {
    problems.push("Only stockable items can be serialized.");
  }

  return problems;
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Trims text, drops facet fields that do not apply, and fills defaults. */
export function normalizeCatalogItemInput(input: CatalogItemInput): CatalogItemInput {
  return {
    name: input.name.trim(),
    description: trimOrNull(input.description),
    categoryId: input.categoryId ?? null,
    itemKind: input.itemKind,
    isSellable: input.isSellable,
    sellPriceCents: input.isSellable ? (input.sellPriceCents ?? null) : null,
    memberPriceCents: input.isSellable ? (input.memberPriceCents ?? null) : null,
    isTaxable: input.isTaxable ?? true,
    isStockable: input.isStockable,
    sku: input.isStockable ? trimOrNull(input.sku) : null,
    unit: input.isStockable ? trimOrNull(input.unit) : null,
    trackingMode: input.isStockable ? (input.trackingMode ?? "quantity") : "quantity",
    brand: trimOrNull(input.brand),
    model: trimOrNull(input.model),
    mfrPartNumber: trimOrNull(input.mfrPartNumber),
    sizeAttrs: input.sizeAttrs ?? {},
    isActive: input.isActive ?? true,
  };
}

export function validatePriceTierInput(tier: CatalogPriceTierInput): string[] {
  const problems: string[] = [];
  if (blank(tier.label)) problems.push("Each price tier needs a label.");
  if (!isCents(tier.priceCents)) problems.push("Tier price must be whole cents, 0 or more.");
  if (tier.memberPriceCents != null && !isCents(tier.memberPriceCents)) {
    problems.push("Tier member price must be whole cents, 0 or more.");
  }
  return problems;
}

/** Tier labels must be unique, case-insensitively (matches the unique index). */
export function findDuplicateTierLabel(tiers: readonly CatalogPriceTierInput[]): string | null {
  const seen = new Set<string>();
  for (const tier of tiers) {
    const key = tier.label.trim().toLowerCase();
    if (seen.has(key)) return tier.label.trim();
    seen.add(key);
  }
  return null;
}
