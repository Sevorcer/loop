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
  PropertyStatus,
  PropertyType,
} from "@/features/properties/types/property";
import { formatPropertyAddress } from "@/features/properties/utils/formatPropertyAddress";
import { geocodeAddress } from "./geocoding";

// ---------------------------------------------------------------------------
// Input types — decoupled from the full Property read model so that the
// write surface is explicit and stable regardless of how the read model evolves.
// ---------------------------------------------------------------------------

export interface CreatePropertyInput {
  name: string;
  customer: string;
  address: string;
  city: string;
  type: PropertyType;
  status: PropertyStatus;
  primarySystem: string;
  openJobs: number;
  lastVisit: string;
}

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

// ---------------------------------------------------------------------------
// Result types — callers can inspect geocoding status without parsing the
// returned property or catching exceptions.
// ---------------------------------------------------------------------------

export type GeocodeStatus =
  /** Address was geocoded successfully; location reflects new coordinates. */
  | "geocoded"
  /** Geocoding was attempted but failed; previous location was preserved. */
  | "geocode_failed_location_preserved"
  /** Address did not change; existing location was kept as-is. */
  | "location_unchanged"
  /** No previous location existed and geocoding was not attempted or failed with no prior data. */
  | "no_location";

export interface CreatePropertyResult {
  property: Property;
  geocodeStatus: GeocodeStatus;
}

export interface UpdatePropertyResult {
  property: Property;
  geocodeStatus: GeocodeStatus;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function resolveLocation(
  address: string,
  city: string
): Promise<{ location: PropertyLocation | undefined; geocoded: boolean }> {
  const fullAddress = formatPropertyAddress({ address, city });
  const result = await geocodeAddress(fullAddress);

  if (!result.success) {
    console.warn(
      `[properties] Geocoding failed for "${fullAddress}": ${result.error}`
    );
    return { location: undefined, geocoded: false };
  }

  return { location: result.location, geocoded: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new property with automatic geocoding.
 *
 * If geocoding fails the property is still created — location will be absent
 * and can be populated later when the address is corrected or geocoding recovers.
 *
 * TODO: Replace mock return with a Supabase insert when the schema is ready.
 */
export async function createProperty(
  input: CreatePropertyInput
): Promise<CreatePropertyResult> {
  const { location, geocoded } = await resolveLocation(
    input.address,
    input.city
  );

  const property: Property = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    location,
  };

  // TODO: persist to Supabase
  // await supabase.from("properties").insert(property);

  return {
    property,
    geocodeStatus: geocoded ? "geocoded" : "no_location",
  };
}

/**
 * Update an existing property.
 *
 * Re-geocodes automatically when the address or city changes.
 *
 * If re-geocoding fails, the existing location is preserved rather than
 * discarded — a geocoding outage should never silently destroy coordinates
 * that were already stored on the record.
 *
 * TODO: Replace mock return with a Supabase update when the schema is ready.
 */
export async function updateProperty(
  existing: Property,
  changes: UpdatePropertyInput
): Promise<UpdatePropertyResult> {
  const addressChanged =
    (changes.address !== undefined && changes.address !== existing.address) ||
    (changes.city !== undefined && changes.city !== existing.city);

  let location = existing.location;
  let geocodeStatus: GeocodeStatus = "location_unchanged";

  if (addressChanged) {
    const resolved = await resolveLocation(
      changes.address ?? existing.address,
      changes.city ?? existing.city
    );

    if (resolved.geocoded) {
      // New coordinates from fresh geocode.
      location = resolved.location;
      geocodeStatus = "geocoded";
    } else {
      // Geocoding failed — preserve whatever was stored before rather than
      // silently nulling out coordinates that techs may be relying on for
      // navigation. The caller can inspect geocodeStatus to surface a warning.
      location = existing.location;
      geocodeStatus = existing.location
        ? "geocode_failed_location_preserved"
        : "no_location";
    }
  }

  const property: Property = {
    ...existing,
    ...changes,
    location,
  };

  // TODO: persist to Supabase
  // await supabase.from("properties").update(property).eq("id", existing.id);

  return { property, geocodeStatus };
}
