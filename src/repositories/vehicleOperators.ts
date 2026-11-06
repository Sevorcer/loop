import "server-only";

import type { VanPerson, VehicleOperator } from "@/features/inventory/types/operators";
import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

interface OperatorRow {
  id: string;
  vehicle_id: string;
  user_id: string;
  is_home: boolean;
}

const OPERATOR_COLUMNS = "id,vehicle_id,user_id,is_home";

function mapOperator(row: OperatorRow): VehicleOperator {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    userId: row.user_id,
    isHome: row.is_home,
  };
}

export async function listVehicleOperators(vehicleId?: string): Promise<VehicleOperator[]> {
  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase
    .from("vehicle_operators")
    .select(OPERATOR_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (vehicleId) query = query.eq("vehicle_id", vehicleId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as OperatorRow[]).map(mapOperator);
}

/** Internal logins in this org. Portal is excluded. RLS limits the rows. */
export async function listTeamMembers(): Promise<VanPerson[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, app_role")
    .eq("org_id", orgId);
  if (error) throw new Error(error.message);
  const people: VanPerson[] = [];
  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; app_role: string | null }>) {
    if (!row.app_role || row.app_role === "portal") continue;
    const name = row.full_name?.trim() || row.email?.trim() || "Team member";
    people.push({ id: row.id, name, role: row.app_role });
  }
  return people.sort((a, b) => a.name.localeCompare(b.name));
}

export async function profileIdsInOrg(userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("org_id", orgId)
    .neq("app_role", "portal")
    .in("id", [...userIds]);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as Array<{ id: string }>).map((row) => row.id));
}

/** Drops is_home on every other van for this person so the unique home index can accept the new one. */
export async function clearHomeForUser(userId: string, exceptVehicleId: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("vehicle_operators")
    .update({ is_home: false })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("is_home", true)
    .neq("vehicle_id", exceptVehicleId);
  if (error) throwInventoryDbError(error, "That person already has a home van.");
}

export async function insertVehicleOperator(input: {
  vehicleId: string;
  userId: string;
  isHome: boolean;
}): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase.from("vehicle_operators").insert({
    org_id: orgId,
    vehicle_id: input.vehicleId,
    user_id: input.userId,
    is_home: input.isHome,
  });
  if (error) throwInventoryDbError(error, "That person is already on this van.");
}

export async function setVehicleOperatorHome(vehicleId: string, userId: string, isHome: boolean): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("vehicle_operators")
    .update({ is_home: isHome })
    .eq("org_id", orgId)
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId);
  if (error) throwInventoryDbError(error, "That person already has a home van.");
}

export async function deleteVehicleOperator(vehicleId: string, userId: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("vehicle_operators")
    .delete()
    .eq("org_id", orgId)
    .eq("vehicle_id", vehicleId)
    .eq("user_id", userId);
  if (error) throwInventoryDbError(error, "That assignment could not be removed.");
}
