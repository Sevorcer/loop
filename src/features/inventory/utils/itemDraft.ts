/** Form-state <-> API payload conversion for the item forms (pure, so it is unit tested). */

import type { CatalogItemInput, CatalogItemWithCost, CatalogPriceTier, CatalogPriceTierInput, ItemKind, TrackingMode } from "../types/catalog";
import { validateCatalogItemInput, validatePriceTierInput, findDuplicateTierLabel } from "./catalogRules";
import { centsToDollarsInput, parseDollarsToCents } from "./money";

export interface ItemDraft {
  name: string;
  description: string;
  categoryId: string;
  itemKind: ItemKind;
  isSellable: boolean;
  sellPrice: string;
  memberPrice: string;
  isTaxable: boolean;
  isStockable: boolean;
  sku: string;
  unit: string;
  trackingMode: TrackingMode;
  brand: string;
  model: string;
  mfrPartNumber: string;
  isActive: boolean;
  unitCost: string;
  preferredVendor: string;
}

export function emptyItemDraft(): ItemDraft {
  return {
    name: "", description: "", categoryId: "", itemKind: "product", isSellable: false, sellPrice: "", memberPrice: "",
    isTaxable: true, isStockable: true, sku: "", unit: "ea", trackingMode: "quantity", brand: "", model: "",
    mfrPartNumber: "", isActive: true, unitCost: "", preferredVendor: "",
  };
}

export function draftFromItem(item: CatalogItemWithCost): ItemDraft {
  return {
    name: item.name,
    description: item.description ?? "",
    categoryId: item.categoryId ?? "",
    itemKind: item.itemKind,
    isSellable: item.isSellable,
    sellPrice: centsToDollarsInput(item.sellPriceCents),
    memberPrice: centsToDollarsInput(item.memberPriceCents),
    isTaxable: item.isTaxable,
    isStockable: item.isStockable,
    sku: item.sku ?? "",
    unit: item.unit ?? "",
    trackingMode: item.trackingMode,
    brand: item.brand ?? "",
    model: item.model ?? "",
    mfrPartNumber: item.mfrPartNumber ?? "",
    isActive: item.isActive,
    unitCost: centsToDollarsInput(item.cost?.unitCostCents),
    preferredVendor: item.cost?.preferredVendor ?? "",
  };
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export type DraftResult = { ok: true; payload: Record<string, unknown> } | { ok: false; problem: string };

/**
 * Builds the request body. `cost` is included only when `includeCost` is true
 * (the caller may set cost) and a unit cost was typed.
 */
export function itemDraftToPayload(draft: ItemDraft, options: { includeCost: boolean }): DraftResult {
  const sell = parseDollarsToCents(draft.sellPrice);
  const member = parseDollarsToCents(draft.memberPrice);
  if (sell === undefined) return { ok: false, problem: "Sell price must be dollars, like 129.00." };
  if (member === undefined) return { ok: false, problem: "Member price must be dollars, like 119.00." };

  const input: CatalogItemInput = {
    name: draft.name,
    description: textOrNull(draft.description),
    categoryId: draft.categoryId || null,
    itemKind: draft.itemKind,
    isSellable: draft.isSellable,
    sellPriceCents: draft.isSellable ? sell : null,
    memberPriceCents: draft.isSellable ? member : null,
    isTaxable: draft.isTaxable,
    isStockable: draft.isStockable,
    sku: draft.isStockable ? textOrNull(draft.sku) : null,
    unit: draft.isStockable ? textOrNull(draft.unit) : null,
    trackingMode: draft.isStockable ? draft.trackingMode : "quantity",
    brand: textOrNull(draft.brand),
    model: textOrNull(draft.model),
    mfrPartNumber: textOrNull(draft.mfrPartNumber),
    isActive: draft.isActive,
  };
  const problems = validateCatalogItemInput(input);
  if (problems.length > 0) return { ok: false, problem: problems.join(" ") };

  const payload: Record<string, unknown> = { ...input };
  if (options.includeCost && draft.unitCost.trim()) {
    const cents = parseDollarsToCents(draft.unitCost);
    if (cents === undefined || cents === null) return { ok: false, problem: "Unit cost must be dollars, like 42.50." };
    payload.cost = { unitCostCents: cents, preferredVendor: textOrNull(draft.preferredVendor) };
  }
  return { ok: true, payload };
}

export interface TierDraft {
  key: string;
  label: string;
  price: string;
  memberPrice: string;
}

export function tierDraftsFromTiers(tiers: readonly CatalogPriceTier[]): TierDraft[] {
  return tiers.map((tier) => ({
    key: tier.id,
    label: tier.label,
    price: centsToDollarsInput(tier.priceCents),
    memberPrice: centsToDollarsInput(tier.memberPriceCents),
  }));
}

export function tiersToPayload(
  drafts: readonly TierDraft[],
): { ok: true; tiers: CatalogPriceTierInput[] } | { ok: false; problem: string } {
  const tiers: CatalogPriceTierInput[] = [];
  for (const [index, draft] of drafts.entries()) {
    const price = parseDollarsToCents(draft.price);
    const member = parseDollarsToCents(draft.memberPrice);
    if (price === undefined || price === null) return { ok: false, problem: `Tier ${index + 1}: enter a price like 4500.00.` };
    if (member === undefined) return { ok: false, problem: `Tier ${index + 1}: member price must be dollars.` };
    const tier: CatalogPriceTierInput = { label: draft.label.trim(), priceCents: price, memberPriceCents: member, sortOrder: index };
    const problems = validatePriceTierInput(tier);
    if (problems.length > 0) return { ok: false, problem: `Tier ${index + 1}: ${problems.join(" ")}` };
    tiers.push(tier);
  }
  if (tiers.length === 0) return { ok: false, problem: "Add at least one tier." };
  const duplicate = findDuplicateTierLabel(tiers);
  if (duplicate) return { ok: false, problem: `Tier label "${duplicate}" is used twice.` };
  return { ok: true, tiers };
}
