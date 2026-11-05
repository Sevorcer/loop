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

function mapVehicle(row: VehicleRow, crewId: string | null = null): Vehicle {
  return {
    id: row.id,
    name: row.name,
    plate: row.plate,
    vin: row.vin,
    status: row.status as VehicleStatus,
    // A van's crew is crews.vehicle_id (the single source); the caller supplies it from crews.
    crewId,
    notes: row.notes,
  };
}

/** vehicle id -> crew id, from crews.vehicle_id. */
async function crewIdsByVehicle(vehicleIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (vehicleIds.length === 0) return map;
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("crews")
    .select("id,vehicle_id")
    .eq("org_id", orgId)
    .in("vehicle_id", vehicleIds);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<{ id: string; vehicle_id: string | null }>) {
    if (row.vehicle_id) map.set(row.vehicle_id, row.id);
  }
  return map;
}

export async function listVehicles(includeRetired = false): Promise<Vehicle[]> {
  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase.from("vehicles").select(VEHICLE_COLUMNS).eq("org_id", orgId).order("name", { ascending: true });
  if (!includeRetired) query = query.neq("status", "retired");
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as VehicleRow[];
  const crews = await crewIdsByVehicle(rows.map((row) => row.id));
  return rows.map((row) => mapVehicle(row, crews.get(row.id) ?? null));
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
  if (!data) return null;
  const crews = await crewIdsByVehicle([id]);
  return mapVehicle(data as VehicleRow, crews.get(id) ?? null);
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
  // A crew-only change touches crews, not this table: nothing to update here.
  if (Object.keys(row).length === 0) return getVehicle(id);
  const { data, error } = await supabase
    .from("vehicles")
    .update(row)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(VEHICLE_COLUMNS);
  if (error) throwInventoryDbError(error, "A vehicle with that name already exists.");
  const first = ((data ?? []) as VehicleRow[])[0];
  if (!first) return null;
  const crews = await crewIdsByVehicle([id]);
  return mapVehicle(first, crews.get(id) ?? null);
}

/**
 * Assigns a van to a crew (or frees it with crewId = null). `crews.vehicle_id` is
 * the single source of the link: one vehicle per crew is structural (it is a
 * scalar on the crew) and one crew per vehicle is enforced by a unique index.
 * Assigning a crew to a van replaces whatever van that crew had before.
 *
 * Crews are writable only by owner/manager/dispatch (RLS), so a role that
 * cannot write crews fails here with a 403. Every step is idempotent.
 */
export async function relinkCrewVehicle(vehicleId: string, crewId: string | null): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();

  // Release whichever crew is currently on this vehicle.
  const release = await supabase
    .from("crews")
    .update({ vehicle_id: null })
    .eq("org_id", orgId)
    .eq("vehicle_id", vehicleId);
  if (release.error) throwInventoryDbError(release.error, "Could not release the crew from this vehicle.");

  if (!crewId) return;

  // Put the crew on this vehicle (displaces its previous vehicle).
  const assign = await supabase
    .from("crews")
    .update({ vehicle_id: vehicleId })
    .eq("org_id", orgId)
    .eq("id", crewId)
    .select("id");
  if (assign.error) throwInventoryDbError(assign.error, "Could not assign the crew to this vehicle.");
  if (!assign.data || assign.data.length === 0) {
    throw Object.assign(new Error("Crew not found."), { status: 404 });
  }
}
