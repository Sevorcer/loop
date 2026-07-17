/**
 * Server-only property service.
 *
 * Handles property create and update operations with automatic geocoding.
 * When a property is saved, the address is geocoded and enriched location
 * data (latitude, longitude, formattedAddress, placeId) is stored alongside it.
 *
 * Persistence is currently mocked — replace the mock implementations with
 * real Supabase calls when the database schema is ready.
 */

import "server-only";

import type {
  Property,
  PropertyLocation,
} from "@/features/properties/types/property";
import { geocodeAddress } from "./geocoding";

export type CreatePropertyInput = Omit<
  Property,
  "id" | "createdAt" | "location"
>;

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

/**
 * Resolve location data for a property address.
 *
 * Falls back gracefully when geocoding is unavailable so that property
 * saves are never blocked by a geocoding failure.
 */
async function resolveLocation(
  address: string,
  city: string
): Promise<PropertyLocation | undefined> {
  const fullAddress = `${address}, ${city}`;
  const result = await geocodeAddress(fullAddress);

  if (!result.success) {
    console.warn(`[properties] Geocoding failed for "${fullAddress}": ${result.error}`);
    return undefined;
  }

  return result.location;
}

/**
 * Create a new property with automatic geocoding.
 *
 * TODO: Replace mock return with a Supabase insert when the schema is ready.
 */
export async function createProperty(
  input: CreatePropertyInput
): Promise<Property> {
  const location = await resolveLocation(input.address, input.city);

  const property: Property = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    location,
  };

  // TODO: persist to Supabase
  // await supabase.from("properties").insert(property);

  return property;
}

/**
 * Update an existing property.
 *
 * Re-geocodes automatically when the address or city changes.
 *
 * TODO: Replace mock return with a Supabase update when the schema is ready.
 */
export async function updateProperty(
  existing: Property,
  changes: UpdatePropertyInput
): Promise<Property> {
  const addressChanged =
    (changes.address !== undefined && changes.address !== existing.address) ||
    (changes.city !== undefined && changes.city !== existing.city);

  const location = addressChanged
    ? await resolveLocation(
        changes.address ?? existing.address,
        changes.city ?? existing.city
      )
    : existing.location;

  const updated: Property = {
    ...existing,
    ...changes,
    location,
  };

  // TODO: persist to Supabase
  // await supabase.from("properties").update(updated).eq("id", existing.id);

  return updated;
}
