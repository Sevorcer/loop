import "server-only";

import type {
  CatalogCategory,
  CatalogItem,
  CatalogItemCost,
  CatalogItemFilters,
  CatalogItemInput,
  CatalogPriceTier,
  CatalogPriceTierInput,
  ItemKind,
  TrackingMode,
} from "@/features/inventory/types/catalog";
import { sanitizeSearchTerm, throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface ItemRow {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  item_kind: string;
  is_sellable: boolean;
  sell_price_cents: number | null;
  member_price_cents: number | null;
  is_taxable: boolean;
  is_stockable: boolean;
  sku: string | null;
  unit: string | null;
  tracking_mode: string;
  brand: string | null;
  model: string | null;
  mfr_part_number: string | null;
  size_attrs: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TierRow {
  id: string;
  item_id: string;
  label: string;
  price_cents: number;
  member_price_cents: number | null;
  sort_order: number;
}

interface CostRow {
  item_id: string;
  unit_cost_cents: number;
  preferred_vendor: string | null;
  cost_updated_at: string;
}

const CATEGORY_COLUMNS = "id,parent_id,name,sort_order,is_active";
const ITEM_COLUMNS =
  "id,category_id,name,description,item_kind,is_sellable,sell_price_cents,member_price_cents,is_taxable,is_stockable,sku,unit,tracking_mode,brand,model,mfr_part_number,size_attrs,is_active,created_at,updated_at";
const TIER_COLUMNS = "id,item_id,label,price_cents,member_price_cents,sort_order";
const COST_COLUMNS = "item_id,unit_cost_cents,preferred_vendor,cost_updated_at";

function mapCategory(row: CategoryRow): CatalogCategory {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function mapItem(row: ItemRow): CatalogItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    itemKind: row.item_kind as ItemKind,
    isSellable: row.is_sellable,
    sellPriceCents: row.sell_price_cents,
    memberPriceCents: row.member_price_cents,
    isTaxable: row.is_taxable,
    isStockable: row.is_stockable,
    sku: row.sku,
    unit: row.unit,
    trackingMode: row.tracking_mode as TrackingMode,
    brand: row.brand,
    model: row.model,
    mfrPartNumber: row.mfr_part_number,
    sizeAttrs: row.size_attrs ?? {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTier(row: TierRow): CatalogPriceTier {
  return {
    id: row.id,
    itemId: row.item_id,
    label: row.label,
    priceCents: row.price_cents,
    memberPriceCents: row.member_price_cents,
    sortOrder: row.sort_order,
  };
}

function mapCost(row: CostRow): CatalogItemCost {
  return {
    itemId: row.item_id,
    unitCostCents: row.unit_cost_cents,
    preferredVendor: row.preferred_vendor,
    costUpdatedAt: row.cost_updated_at,
  };
}

function itemToRow(input: CatalogItemInput) {
  return {
    category_id: input.categoryId ?? null,
    name: input.name,
    description: input.description ?? null,
    item_kind: input.itemKind,
    is_sellable: input.isSellable,
    sell_price_cents: input.sellPriceCents ?? null,
    member_price_cents: input.memberPriceCents ?? null,
    is_taxable: input.isTaxable ?? true,
    is_stockable: input.isStockable,
    sku: input.sku ?? null,
    unit: input.unit ?? null,
    tracking_mode: input.trackingMode ?? "quantity",
    brand: input.brand ?? null,
    model: input.model ?? null,
    mfr_part_number: input.mfrPartNumber ?? null,
    size_attrs: input.sizeAttrs ?? {},
    is_active: input.isActive ?? true,
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(includeInactive = false): Promise<CatalogCategory[]> {
  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase
    .from("catalog_categories")
    .select(CATEGORY_COLUMNS)
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as CategoryRow[]).map(mapCategory);
}

export async function createCategory(input: {
  name: string;
  parentId: string | null;
  sortOrder?: number;
}): Promise<CatalogCategory> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("catalog_categories")
    .insert({ org_id: orgId, name: input.name, parent_id: input.parentId, sort_order: input.sortOrder ?? 0 })
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) throwInventoryDbError(error, "A category with that name already exists here.");
  return mapCategory(data as CategoryRow);
}

export async function updateCategory(
  id: string,
  patch: { name?: string; parentId?: string | null; sortOrder?: number; isActive?: boolean },
): Promise<CatalogCategory | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.parentId !== undefined) row.parent_id = patch.parentId;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  const { data, error } = await supabase
    .from("catalog_categories")
    .update(row)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(CATEGORY_COLUMNS);
  if (error) throwInventoryDbError(error, "A category with that name already exists here.");
  const first = ((data ?? []) as CategoryRow[])[0];
  return first ? mapCategory(first) : null;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function listItems(filters: CatalogItemFilters = {}): Promise<CatalogItem[]> {
  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase.from("catalog_items").select(ITEM_COLUMNS).eq("org_id", orgId);

  if (!filters.includeInactive) query = query.eq("is_active", true);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.facet === "sellable") query = query.eq("is_sellable", true);
  if (filters.facet === "stockable") query = query.eq("is_stockable", true);
  if (filters.facet === "both") query = query.eq("is_sellable", true).eq("is_stockable", true);

  const term = filters.search ? sanitizeSearchTerm(filters.search) : "";
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);

  const limit = Math.min(Math.max(filters.limit ?? 500, 1), 1000);
  const { data, error } = await query.order("name", { ascending: true }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ItemRow[]).map(mapItem);
}

export async function getItem(id: string): Promise<CatalogItem | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("catalog_items")
    .select(ITEM_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapItem(data as ItemRow) : null;
}

export async function createItem(input: CatalogItemInput): Promise<CatalogItem> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("catalog_items")
    .insert({ org_id: orgId, ...itemToRow(input) })
    .select(ITEM_COLUMNS)
    .single();
  if (error) throwInventoryDbError(error, "An item with that SKU already exists.");
  return mapItem(data as ItemRow);
}

export async function updateItem(id: string, input: CatalogItemInput): Promise<CatalogItem | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("catalog_items")
    .update(itemToRow(input))
    .eq("org_id", orgId)
    .eq("id", id)
    .select(ITEM_COLUMNS);
  if (error) throwInventoryDbError(error, "An item with that SKU already exists.");
  const first = ((data ?? []) as ItemRow[])[0];
  return first ? mapItem(first) : null;
}

// ---------------------------------------------------------------------------
// Price tiers (sell prices; same visibility as the item)
// ---------------------------------------------------------------------------

export async function listTiers(itemId: string): Promise<CatalogPriceTier[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("catalog_price_tiers")
    .select(TIER_COLUMNS)
    .eq("org_id", orgId)
    .eq("item_id", itemId)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TierRow[]).map(mapTier);
}

/**
 * Inserts new tiers and updates existing ones (matched by label, case-insensitive).
 * Removing a tier is a separate owner-only delete.
 */
export async function upsertTiers(
  itemId: string,
  tiers: readonly CatalogPriceTierInput[],
): Promise<CatalogPriceTier[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const existing = await listTiers(itemId);
  const byLabel = new Map(existing.map((tier) => [tier.label.toLowerCase(), tier]));

  for (const [index, tier] of tiers.entries()) {
    const label = tier.label.trim();
    const row = {
      label,
      price_cents: tier.priceCents,
      member_price_cents: tier.memberPriceCents ?? null,
      sort_order: tier.sortOrder ?? index,
    };
    const match = byLabel.get(label.toLowerCase());
    const result = match
      ? await supabase.from("catalog_price_tiers").update(row).eq("org_id", orgId).eq("id", match.id)
      : await supabase.from("catalog_price_tiers").insert({ org_id: orgId, item_id: itemId, ...row });
    if (result.error) throwInventoryDbError(result.error, "A tier with that label already exists.");
  }
  return listTiers(itemId);
}

export async function deleteTier(itemId: string, tierId: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("catalog_price_tiers")
    .delete()
    .eq("org_id", orgId)
    .eq("item_id", itemId)
    .eq("id", tierId)
    .select("id");
  if (error) throwInventoryDbError(error);
  return (data ?? []).length > 0;
}

// ---------------------------------------------------------------------------
// Costs (separate table; RLS limits reads to owner/manager/office)
// ---------------------------------------------------------------------------

export async function listCostsByItemIds(itemIds: readonly string[]): Promise<Map<string, CatalogItemCost>> {
  const costs = new Map<string, CatalogItemCost>();
  if (itemIds.length === 0) return costs;
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("catalog_item_costs")
    .select(COST_COLUMNS)
    .eq("org_id", orgId)
    .in("item_id", itemIds as string[]);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as CostRow[]) costs.set(row.item_id, mapCost(row));
  return costs;
}

export async function getCost(itemId: string): Promise<CatalogItemCost | null> {
  const costs = await listCostsByItemIds([itemId]);
  return costs.get(itemId) ?? null;
}

export async function upsertCost(
  itemId: string,
  input: { unitCostCents: number; preferredVendor: string | null },
  userId: string | null,
): Promise<CatalogItemCost> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("catalog_item_costs")
    .upsert(
      {
        org_id: orgId,
        item_id: itemId,
        unit_cost_cents: input.unitCostCents,
        preferred_vendor: input.preferredVendor,
        cost_updated_at: new Date().toISOString(),
        cost_updated_by: userId,
      },
      { onConflict: "item_id" },
    )
    .select(COST_COLUMNS)
    .single();
  if (error) throwInventoryDbError(error);
  return mapCost(data as CostRow);
}
