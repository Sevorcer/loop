import "server-only";

import type {
  InventoryLocation,
  InventoryLocationInput,
  Vehicle,
  VehicleInput,
} from "@/features/inventory/types/ledger";
import { VEHICLE_STATUSES } from "@/features/inventory/types/ledger";
import {
  createLocation as createLocationRecord,
  createVanLocation,
  getLocation,
  getVanLocationForVehicle,
  listLocations as listLocationRecords,
  updateLocation as updateLocationRecord,
} from "@/repositories/inventoryLocations";
import {
  createVehicle as createVehicleRecord,
  getVehicle,
  listVehicles as listVehicleRecords,
  relinkCrewVehicle,
  updateVehicle as updateVehicleRecord,
} from "@/repositories/vehicles";

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function notFound(what: string): never {
  throw Object.assign(new Error(`${what} not found.`), { status: 404 });
}

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function listLocations(includeInactive = false): Promise<InventoryLocation[]> {
  return listLocationRecords(includeInactive);
}

export async function createLocation(input: InventoryLocationInput): Promise<InventoryLocation> {
  const name = input.name.trim();
  if (!name) badRequest("name is required.");
  if (input.type !== "warehouse" && input.type !== "quarantine") {
    badRequest("Only warehouse and quarantine locations are created directly; vans come with a vehicle.");
  }
  return createLocationRecord({ ...input, name, address: clean(input.address) });
}

export async function updateLocation(
  id: string,
  patch: { name?: string; parentLocationId?: string | null; address?: string | null; isActive?: boolean },
): Promise<InventoryLocation> {
  if (patch.name !== undefined && !patch.name.trim()) badRequest("name cannot be blank.");
  if (patch.parentLocationId === id) badRequest("A location cannot be its own parent.");
  const updated = await updateLocationRecord(id, {
    ...patch,
    name: patch.name?.trim(),
    address: patch.address === undefined ? undefined : clean(patch.address),
  });
  if (!updated) notFound("Location");
  return updated;
}

// ---------------------------------------------------------------------------
// Vehicles — each vehicle owns one van location (created with it, idempotent)
// ---------------------------------------------------------------------------

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Unknown error.";
}

/** Rethrows with a new message, keeping the original HTTP status. */
function withMessage(error: unknown, message: string): Error {
  const status = (error as { status?: unknown } | null)?.status;
  return Object.assign(new Error(message), typeof status === "number" ? { status } : {});
}

export async function listVehicles(includeRetired = false): Promise<Vehicle[]> {
  return listVehicleRecords(includeRetired);
}

/** Creates the van location for a vehicle if it has none. Safe to call repeatedly. */
export async function ensureVanLocation(vehicle: Vehicle): Promise<InventoryLocation> {
  const existing = await getVanLocationForVehicle(vehicle.id);
  if (existing) return existing;

  const warehouses = (await listLocationRecords(false)).filter((location) => location.type === "warehouse");
  const parentLocationId = warehouses.length === 1 ? warehouses[0].id : null;
  try {
    return await createVanLocation({ vehicleId: vehicle.id, name: vehicle.name, parentLocationId });
  } catch (error) {
    // Location names are unique across the org; fall back to a disambiguated name.
    if ((error as { status?: number }).status === 409) {
      return createVanLocation({ vehicleId: vehicle.id, name: `${vehicle.name} (van)`, parentLocationId });
    }
    throw error;
  }
}

export async function createVehicle(input: VehicleInput): Promise<{ vehicle: Vehicle; location: InventoryLocation }> {
  const name = input.name.trim();
  if (!name) badRequest("name is required.");
  if (input.status !== undefined && !VEHICLE_STATUSES.includes(input.status)) badRequest("status is not valid.");

  // The crew link is crews.vehicle_id, written after the vehicle exists.
  const crewId = input.crewId ?? null;
  const created = await createVehicleRecord({
    ...input,
    crewId: null,
    name,
    plate: clean(input.plate),
    vin: clean(input.vin),
    notes: clean(input.notes),
  });
  const location = await ensureVanLocation(created);
  if (!crewId) return { vehicle: created, location };

  try {
    await relinkCrewVehicle(created.id, crewId);
  } catch (error) {
    throw withMessage(error, `"${name}" was added, but it could not be assigned to the crew. ${messageOf(error)}`);
  }
  return { vehicle: { ...created, crewId }, location };
}

export async function updateVehicle(id: string, patch: Partial<VehicleInput>): Promise<Vehicle> {
  if (patch.name !== undefined && !patch.name.trim()) badRequest("name cannot be blank.");
  if (patch.status !== undefined && !VEHICLE_STATUSES.includes(patch.status)) badRequest("status is not valid.");

  // Skipped when the crew is unchanged, so editing other fields never needs crew-write access.
  if (patch.crewId !== undefined) {
    const current = await getVehicleOrThrow(id);
    if ((current.crewId ?? null) !== patch.crewId) await relinkCrewVehicle(id, patch.crewId);
  }

  const updated = await updateVehicleRecord(id, {
    ...patch,
    crewId: undefined, // the link lives on crews; handled above
    name: patch.name?.trim(),
    plate: patch.plate === undefined ? undefined : clean(patch.plate),
    vin: patch.vin === undefined ? undefined : clean(patch.vin),
    notes: patch.notes === undefined ? undefined : clean(patch.notes),
  });
  if (!updated) notFound("Vehicle");

  // Keep the van location's name and active flag in step with its vehicle (best effort).
  const location = await getVanLocationForVehicle(id);
  if (location) {
    const wantsActive = updated.status !== "retired";
    if (location.isActive !== wantsActive) {
      await updateLocationRecord(location.id, { isActive: wantsActive });
    }
  }
  return updated;
}

export async function getVehicleOrThrow(id: string): Promise<Vehicle> {
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound("Vehicle");
  return vehicle;
}

export async function getLocationOrThrow(id: string): Promise<InventoryLocation> {
  const location = await getLocation(id);
  if (!location) notFound("Location");
  return location;
}
