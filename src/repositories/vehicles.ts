import "server-only";

import type { Vehicle, VehicleInput, VehicleStatus } from "@/features/inventory/types/ledger";
import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

interface VehicleRow {
  id: string;
  name: string;
  plate: string | null;
  vin: string | null;
  status: string;
  notes: string | null;
}

const VEHICLE_COLUMNS = "id,name,plate,vin,status,notes";

function mapVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    name: row.name,
    plate: row.plate,
    vin: row.vin,
    status: row.status as VehicleStatus,
    // A van's crew is crews.vehicle_id (M3), not a column here; it is filled in once that migration lands.
    crewId: null,
    notes: row.notes,
  };
}

export async function listVehicles(includeRetired = false): Promise<Vehicle[]> {
  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase.from("vehicles").select(VEHICLE_COLUMNS).eq("org_id", orgId).order("name", { ascending: true });
  if (!includeRetired) query = query.neq("status", "retired");
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as VehicleRow[]).map(mapVehicle);
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("vehicles")
    .select(VEHICLE_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapVehicle(data as VehicleRow) : null;
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      org_id: orgId,
      name: input.name,
      plate: input.plate ?? null,
      vin: input.vin ?? null,
      status: input.status ?? "active",
      notes: input.notes ?? null,
    })
    .select(VEHICLE_COLUMNS)
    .single();
  if (error) throwInventoryDbError(error, "A vehicle with that name already exists.");
  return mapVehicle(data as VehicleRow);
}

export async function updateVehicle(id: string, patch: Partial<VehicleInput>): Promise<Vehicle | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.plate !== undefined) row.plate = patch.plate;
  if (patch.vin !== undefined) row.vin = patch.vin;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.notes !== undefined) row.notes = patch.notes;
  const { data, error } = await supabase
    .from("vehicles")
    .update(row)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(VEHICLE_COLUMNS);
  if (error) throwInventoryDbError(error, "A vehicle with that name already exists.");
  const first = ((data ?? []) as VehicleRow[])[0];
  return first ? mapVehicle(first) : null;
}
