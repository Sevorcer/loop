import "server-only";

import type {
  InventoryLocation,
  InventoryLocationInput,
  LocationType,
} from "@/features/inventory/types/ledger";
import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

interface LocationRow {
  id: string;
  type: string;
  name: string;
  parent_location_id: string | null;
  vehicle_id: string | null;
  job_id: string | null;
  address: string | null;
  is_active: boolean;
}

const LOCATION_COLUMNS = "id,type,name,parent_location_id,vehicle_id,job_id,address,is_active";

function mapLocation(row: LocationRow): InventoryLocation {
  return {
    id: row.id,
    type: row.type as LocationType,
    name: row.name,
    parentLocationId: row.parent_location_id,
    vehicleId: row.vehicle_id,
    jobId: row.job_id,
    address: row.address,
    isActive: row.is_active,
  };
}

export async function listLocations(includeInactive = false): Promise<InventoryLocation[]> {
  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase
    .from("inventory_locations")
    .select(LOCATION_COLUMNS)
    .eq("org_id", orgId)
    .neq("type", "job") // virtual buy-for-job locations are not browsed as stock locations
    .order("type", { ascending: true })
    .order("name", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as LocationRow[]).map(mapLocation);
}

export async function getLocation(id: string): Promise<InventoryLocation | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_locations")
    .select(LOCATION_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapLocation(data as LocationRow) : null;
}

export async function getVanLocationForVehicle(vehicleId: string): Promise<InventoryLocation | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_locations")
    .select(LOCATION_COLUMNS)
    .eq("org_id", orgId)
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapLocation(data as LocationRow) : null;
}

export async function createLocation(input: InventoryLocationInput): Promise<InventoryLocation> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_locations")
    .insert({
      org_id: orgId,
      type: input.type,
      name: input.name,
      parent_location_id: input.parentLocationId ?? null,
      address: input.address ?? null,
      is_active: input.isActive ?? true,
    })
    .select(LOCATION_COLUMNS)
    .single();
  if (error) throwInventoryDbError(error, "A location with that name already exists.");
  return mapLocation(data as LocationRow);
}

export async function createVanLocation(input: {
  vehicleId: string;
  name: string;
  parentLocationId: string | null;
}): Promise<InventoryLocation> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_locations")
    .insert({
      org_id: orgId,
      type: "van",
      name: input.name,
      vehicle_id: input.vehicleId,
      parent_location_id: input.parentLocationId,
    })
    .select(LOCATION_COLUMNS)
    .single();
  if (error) throwInventoryDbError(error, "A location with that name already exists.");
  return mapLocation(data as LocationRow);
}

export async function updateLocation(
  id: string,
  patch: { name?: string; parentLocationId?: string | null; address?: string | null; isActive?: boolean },
): Promise<InventoryLocation | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.parentLocationId !== undefined) row.parent_location_id = patch.parentLocationId;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  const { data, error } = await supabase
    .from("inventory_locations")
    .update(row)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(LOCATION_COLUMNS);
  if (error) throwInventoryDbError(error, "A location with that name already exists.");
  const first = ((data ?? []) as LocationRow[])[0];
  return first ? mapLocation(first) : null;
}
