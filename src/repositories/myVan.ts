import "server-only";

import type { TechVanEntry } from "@/features/inventory/utils/vanEntries";
import type { VehicleStatus } from "@/features/inventory/types/ledger";
import { MY_VAN_ACTIVITY_SCAN } from "@/features/inventory/utils/myVanView";

import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

export interface MyVanVehicleRow {
  id: string;
  name: string;
  plate: string | null;
  status: VehicleStatus;
}

export interface MyVanActivityRow {
  id: string;
  txnType: string;
  itemId: string;
  locationId: string;
  qtyDelta: number;
  reason: string | null;
  createdAt: string;
}

interface ActivityRecord {
  id: string;
  txn_type: string;
  item_id: string;
  location_id: string;
  qty_delta: number | string;
  reason: string | null;
  created_at: string;
}

/**
 * Vehicles for the signed-in person's assignments.
 * Does not read crews. The phone identity is vehicle_operators, not a crew name.
 */
export async function listVehiclesById(ids: readonly string[]): Promise<MyVanVehicleRow[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id,name,plate,status")
    .eq("org_id", orgId)
    .in("id", unique);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; name: string; plate: string | null; status: string }>).map((row) => ({
    id: row.id,
    name: row.name,
    plate: row.plate,
    status: row.status as VehicleStatus,
  }));
}

/**
 * Recent van activity from fn_inventory_my_van_activity.
 * The function omits cost, job, and transfer group. This mapper does not add them.
 */
export async function listMyVanActivity(limit = MY_VAN_ACTIVITY_SCAN): Promise<MyVanActivityRow[]> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.rpc("fn_inventory_my_van_activity", { p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ActivityRecord[]).map((row) => ({
    id: row.id,
    txnType: row.txn_type,
    itemId: row.item_id,
    locationId: row.location_id,
    qtyDelta: Number(row.qty_delta),
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

/** Appends a tech count or a shop-to-own-van transfer. The function is the allow-list. */
export async function postMyVanEntries(entries: readonly TechVanEntry[]): Promise<number> {
  if (entries.length === 0) return 0;
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.rpc("fn_inventory_post_van_entries", {
    p_entries: entries,
  });
  if (error) throwInventoryDbError(error, "That van entry could not be posted.");
  return Array.isArray(data) ? data.length : 0;
}
