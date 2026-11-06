import "server-only";

import type {
  KitHeaderPatch,
  KitLineInput,
  KitStatus,
  KitTemplate,
  KitTemplateLine,
  KitTemplateSummary,
} from "@/features/inventory/types/kits";
import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

interface KitRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface LineRow {
  id: string;
  kit_id: string;
  catalog_item_id: string;
  quantity: number | string;
  is_optional: boolean;
  notes: string | null;
  sort_order: number;
}

interface ItemRow {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  item_kind: string;
  is_active: boolean;
}

const KIT_COLUMNS = "id,name,description,category,status,version,created_at,updated_at";
const LINE_COLUMNS = "id,kit_id,catalog_item_id,quantity,is_optional,notes,sort_order";

export async function listKitSummaries(includeArchived = false): Promise<KitTemplateSummary[]> {
  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase.from("kit_templates").select(KIT_COLUMNS).eq("org_id", orgId).order("name", { ascending: true });
  if (!includeArchived) query = query.eq("status", "active");
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const kits = (data ?? []) as KitRow[];
  if (kits.length === 0) return [];

  const { data: lineData, error: lineError } = await supabase
    .from("kit_template_lines")
    .select("kit_id,is_optional")
    .eq("org_id", orgId)
    .in("kit_id", kits.map((kit) => kit.id));
  if (lineError) throw new Error(lineError.message);

  const counts = new Map<string, { total: number; optional: number }>();
  for (const line of (lineData ?? []) as Array<{ kit_id: string; is_optional: boolean }>) {
    const entry = counts.get(line.kit_id) ?? { total: 0, optional: 0 };
    entry.total += 1;
    if (line.is_optional) entry.optional += 1;
    counts.set(line.kit_id, entry);
  }

  return kits.map((kit) => ({
    id: kit.id,
    name: kit.name,
    description: kit.description,
    category: kit.category,
    status: kit.status as KitStatus,
    version: kit.version,
    lineCount: counts.get(kit.id)?.total ?? 0,
    optionalCount: counts.get(kit.id)?.optional ?? 0,
    updatedAt: kit.updated_at,
  }));
}

export async function getKitTemplate(id: string): Promise<KitTemplate | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("kit_templates")
    .select(KIT_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const kit = data as KitRow;

  const { data: lineData, error: lineError } = await supabase
    .from("kit_template_lines")
    .select(LINE_COLUMNS)
    .eq("org_id", orgId)
    .eq("kit_id", id)
    .order("sort_order", { ascending: true });
  if (lineError) throw new Error(lineError.message);
  const lineRows = (lineData ?? []) as LineRow[];

  const items = new Map<string, ItemRow>();
  if (lineRows.length > 0) {
    const { data: itemData, error: itemError } = await supabase
      .from("catalog_items")
      .select("id,name,sku,unit,item_kind,is_active")
      .eq("org_id", orgId)
      .in("id", lineRows.map((line) => line.catalog_item_id));
    if (itemError) throw new Error(itemError.message);
    for (const item of (itemData ?? []) as ItemRow[]) items.set(item.id, item);
  }

  const lines: KitTemplateLine[] = lineRows.map((line) => {
    const item = items.get(line.catalog_item_id);
    return {
      id: line.id,
      catalogItemId: line.catalog_item_id,
      itemName: item?.name ?? "Unknown item",
      sku: item?.sku ?? null,
      unit: item?.unit ?? null,
      itemKind: item?.item_kind ?? "product",
      itemActive: item?.is_active ?? false,
      quantity: Number(line.quantity),
      isOptional: line.is_optional,
      notes: line.notes,
      sortOrder: line.sort_order,
    };
  });

  return {
    id: kit.id,
    name: kit.name,
    description: kit.description,
    category: kit.category,
    status: kit.status as KitStatus,
    version: kit.version,
    createdAt: kit.created_at,
    updatedAt: kit.updated_at,
    lines,
  };
}

/**
 * Atomic create/update through save_kit_template(): header and lines land
 * together, and the version bumps only when line content changed. `lines`
 * undefined leaves lines untouched; an array replaces them.
 */
export async function saveKitTemplate(input: {
  id: string | null;
  header: KitHeaderPatch;
  lines?: KitLineInput[];
}): Promise<string> {
  const { supabase } = await getRepositoryContext();

  const header: Record<string, unknown> = {};
  if (input.header.name !== undefined) header.name = input.header.name;
  if (input.header.description !== undefined) header.description = input.header.description;
  if (input.header.category !== undefined) header.category = input.header.category;
  if (input.header.status !== undefined) header.status = input.header.status;

  const lines =
    input.lines === undefined
      ? null
      : input.lines.map((line) => ({
          catalog_item_id: line.catalogItemId,
          quantity: line.quantity,
          is_optional: line.isOptional === true,
          notes: line.notes ?? null,
        }));

  const { data, error } = await supabase.rpc("save_kit_template", {
    p_kit_id: input.id,
    p_header: header,
    p_lines: lines,
  });
  if (error) {
    if (error.code === "P0002") throw Object.assign(new Error("Kit not found."), { status: 404 });
    throwInventoryDbError(error, "A kit with that name already exists.");
  }
  return data as string;
}
