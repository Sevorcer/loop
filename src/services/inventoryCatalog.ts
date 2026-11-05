import "server-only";

import type {
  CatalogCategory,
  CatalogItem,
  CatalogItemCost,
  CatalogItemFilters,
  CatalogItemInput,
  CatalogItemWithCost,
  CatalogPriceTier,
  CatalogPriceTierInput,
} from "@/features/inventory/types/catalog";
import { validateCategoryParent } from "@/features/inventory/utils/categoryTree";
import {
  findDuplicateTierLabel,
  normalizeCatalogItemInput,
  validatePriceTierInput,
  validateCatalogItemInput,
} from "@/features/inventory/utils/catalogRules";
import {
  createCategory as createCategoryRecord,
  createItem as createItemRecord,
  deleteTier as deleteTierRecord,
  getCost,
  getItem,
  listCategories as listCategoryRecords,
  listCostsByItemIds,
  listItems as listItemRecords,
  listTiers as listTierRecords,
  updateCategory as updateCategoryRecord,
  updateItem as updateItemRecord,
  upsertCost,
  upsertTiers as upsertTierRecords,
} from "@/repositories/catalog";

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function notFound(what: string): never {
  throw Object.assign(new Error(`${what} not found.`), { status: 404 });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(includeInactive = false): Promise<CatalogCategory[]> {
  return listCategoryRecords(includeInactive);
}

export async function createCategory(input: {
  name: string;
  parentId?: string | null;
  sortOrder?: number;
}): Promise<CatalogCategory> {
  const name = input.name.trim();
  if (!name) badRequest("name is required.");
  const parentId = input.parentId ?? null;
  const problem = validateCategoryParent(null, parentId, await listCategoryRecords(true));
  if (problem) badRequest(problem);
  return createCategoryRecord({ name, parentId, sortOrder: input.sortOrder });
}

export async function updateCategory(
  id: string,
  patch: { name?: string; parentId?: string | null; sortOrder?: number; isActive?: boolean },
): Promise<CatalogCategory> {
  if (patch.name !== undefined && !patch.name.trim()) badRequest("name cannot be blank.");
  if (patch.parentId !== undefined) {
    const problem = validateCategoryParent(id, patch.parentId, await listCategoryRecords(true));
    if (problem) badRequest(problem);
  }
  const updated = await updateCategoryRecord(id, {
    ...patch,
    name: patch.name?.trim(),
  });
  if (!updated) notFound("Category");
  return updated;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/**
 * Lists items. `canSeeCost` is decided by the route from the caller's role
 * (catalog_item_costs select). When false, no cost query is made at all.
 */
export async function listCatalogItems(
  filters: CatalogItemFilters,
  options: { canSeeCost: boolean },
): Promise<CatalogItemWithCost[]> {
  const items = await listItemRecords(filters);
  if (!options.canSeeCost) return items;
  const costs = await listCostsByItemIds(items.map((item) => item.id));
  return items.map((item) => ({ ...item, cost: costs.get(item.id) ?? null }));
}

export async function getCatalogItem(id: string, options: { canSeeCost: boolean }): Promise<CatalogItemWithCost> {
  const item = await getItem(id);
  if (!item) notFound("Item");
  if (!options.canSeeCost) return item;
  return { ...item, cost: await getCost(id) };
}

export async function createCatalogItem(input: CatalogItemInput): Promise<CatalogItem> {
  const problems = validateCatalogItemInput(input);
  if (problems.length > 0) badRequest(problems.join(" "));
  return createItemRecord(normalizeCatalogItemInput(input));
}

export async function updateCatalogItem(id: string, patch: Partial<CatalogItemInput>): Promise<CatalogItem> {
  const existing = await getItem(id);
  if (!existing) notFound("Item");

  const merged: CatalogItemInput = {
    name: existing.name,
    description: existing.description,
    categoryId: existing.categoryId,
    itemKind: existing.itemKind,
    isSellable: existing.isSellable,
    sellPriceCents: existing.sellPriceCents,
    memberPriceCents: existing.memberPriceCents,
    isTaxable: existing.isTaxable,
    isStockable: existing.isStockable,
    sku: existing.sku,
    unit: existing.unit,
    trackingMode: existing.trackingMode,
    brand: existing.brand,
    model: existing.model,
    mfrPartNumber: existing.mfrPartNumber,
    sizeAttrs: existing.sizeAttrs,
    isActive: existing.isActive,
    ...patch,
  };

  const problems = validateCatalogItemInput(merged);
  if (problems.length > 0) badRequest(problems.join(" "));
  const updated = await updateItemRecord(id, normalizeCatalogItemInput(merged));
  if (!updated) notFound("Item");
  return updated;
}

// ---------------------------------------------------------------------------
// Cost (route has already checked catalog_item_costs permissions)
// ---------------------------------------------------------------------------

export async function setItemCost(
  itemId: string,
  input: { unitCostCents: number; preferredVendor?: string | null },
  userId: string,
): Promise<CatalogItemCost> {
  if (!Number.isInteger(input.unitCostCents) || input.unitCostCents < 0) {
    badRequest("unitCostCents must be whole cents, 0 or more.");
  }
  const item = await getItem(itemId);
  if (!item) notFound("Item");
  const vendor = input.preferredVendor?.trim() || null;
  return upsertCost(itemId, { unitCostCents: input.unitCostCents, preferredVendor: vendor }, userId);
}

// ---------------------------------------------------------------------------
// Price tiers
// ---------------------------------------------------------------------------

export async function listPriceTiers(itemId: string): Promise<CatalogPriceTier[]> {
  return listTierRecords(itemId);
}

export async function savePriceTiers(
  itemId: string,
  tiers: readonly CatalogPriceTierInput[],
): Promise<CatalogPriceTier[]> {
  const item = await getItem(itemId);
  if (!item) notFound("Item");
  if (!item.isSellable) badRequest("Only sellable items have price tiers.");
  if (tiers.length === 0) badRequest("Provide at least one tier.");
  for (const tier of tiers) {
    const problems = validatePriceTierInput(tier);
    if (problems.length > 0) badRequest(problems.join(" "));
  }
  const duplicate = findDuplicateTierLabel(tiers);
  if (duplicate) badRequest(`Tier label "${duplicate}" is used twice.`);
  return upsertTierRecords(itemId, tiers);
}

export async function removePriceTier(itemId: string, tierId: string): Promise<void> {
  const removed = await deleteTierRecord(itemId, tierId);
  if (!removed) notFound("Price tier");
}
