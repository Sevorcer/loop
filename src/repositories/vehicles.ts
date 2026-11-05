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
  crew_id: string | null;
  notes: string | null;
}

const VEHICLE_COLUMNS = "id,name,plate,vin,status,crew_id,notes";

function mapVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    name: row.name,
    plate: row.plate,
    vin: row.vin,
    status: row.status as VehicleStatus,
    crewId: row.crew_id,
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
      crew_id: input.crewId ?? null,
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
  if (patch.crewId !== undefined) row.crew_id = patch.crewId;
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

/**
 * Keeps the two crew <-> vehicle pointers consistent: `crews.vehicle_id` (what
 * dispatch and daily plans read) and `vehicles.crew_id` (what the Locations &
 * vans screen edits). One crew per vehicle and one vehicle per crew.
 *
 * Crews are writable only by owner/manager/dispatch (RLS), so the crew write
 * goes FIRST: a role that cannot write crews fails here with a 403 before any
 * other row has changed. Every step is idempotent, so a retry converges.
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

  // The crew's previous vehicle no longer points at it.
  const detach = await supabase
    .from("vehicles")
    .update({ crew_id: null })
    .eq("org_id", orgId)
    .eq("crew_id", crewId)
    .neq("id", vehicleId);
  if (detach.error) throwInventoryDbError(detach.error, "Could not update the crew's previous vehicle.");
}
