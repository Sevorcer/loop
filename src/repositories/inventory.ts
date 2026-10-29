import "server-only";

import { mapInventoryItem, isMissingInventoryTable } from "@/features/inventory/utils/mapInventoryItem";
import type { InventoryItem } from "@/features/inventory/types/inventory";

import { getRepositoryContext } from "./supabaseContext";

export interface InventoryLoadResult {
  items: InventoryItem[];
  /** True when the inventory table is not in the database yet. */
  missingTable: boolean;
}

export async function listInventoryItems(): Promise<InventoryLoadResult> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.from("inventory_items").select("*").limit(200);

  if (error) {
    return {
      items: [],
      missingTable: isMissingInventoryTable(error.message),
    };
  }

  const items = ((data ?? []) as Record<string, unknown>[])
    .map(mapInventoryItem)
    .filter((item): item is InventoryItem => item !== null);

  return { items, missingTable: false };
}
