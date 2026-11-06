import "server-only";

import type { ParWrite } from "@/features/inventory/utils/parPayload";
import { parValuesProblem } from "@/features/inventory/utils/parRules";
import { throwInventoryDbError } from "@/repositories/inventoryErrors";
import { getRepositoryContext } from "@/repositories/supabaseContext";

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

/**
 * Saves dirty par rows through fn_inventory_set_par.
 * On-hand is never written here. Cost is never read.
 */
export async function setVanPars(locationId: string, rows: readonly ParWrite[]): Promise<number> {
  if (!locationId.trim()) badRequest("locationId is required.");
  if (rows.length === 0) badRequest("Nothing to save.");
  if (rows.length > 500) badRequest("Save fewer rows at a time.");

  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.itemId.trim()) badRequest("Each row needs an item.");
    if (seen.has(row.itemId)) badRequest("Each item can only be saved once.");
    seen.add(row.itemId);
    const problem = parValuesProblem(row.minQty, row.maxQty);
    if (problem) badRequest(problem);
  }

  const { supabase } = await getRepositoryContext();
  for (const row of rows) {
    const { error } = await supabase.rpc("fn_inventory_set_par", {
      p_location_id: locationId,
      p_item_id: row.itemId,
      p_min: row.minQty,
      p_max: row.maxQty,
    });
    if (error) throwInventoryDbError(error, "That par could not be saved.");
  }
  return rows.length;
}
