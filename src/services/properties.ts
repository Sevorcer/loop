import "server-only";

import type { Property, PropertyLocation, PropertyStatus, PropertyType } from "@/features/properties/types/property";
import {
  countOpenJobsForProperty,
  createPropertyRecord,
  deletePropertyRecord,
  getPropertyById,
  listProperties as listPropertyRecords,
  listPropertiesByCustomerId,
  resolveCustomerIdByName,
  resolvePropertyIdByName as resolvePropertyIdByNameRecord,
  updatePropertyRecord,
} from "@/repositories/properties";
import type { SessionRepositoryContextInput } from "@/repositories/supabaseContext";
import { syncCustomerCounters } from "@/services/customers";
import { geocodeAddress } from "@/services/geocoding";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GeocodeStatus = "geocoded" | "geocode_failed_location_preserved" | "no_geocode";

export interface PropertyMutationResult {
  property: Property;
  geocodeStatus: GeocodeStatus;
}

export interface CreatePropertyInput {
  name: string;
  customer: string;
  address: string;
  city: string;
  type: PropertyType;
  status: PropertyStatus;
  primarySystem: string;
  openJobs?: number;
  lastVisit?: string;
}

export interface UpdatePropertyInput {
  name?: string;
  customer?: string;
  address?: string;
  city?: string;
  type?: PropertyType;
  status?: PropertyStatus;
  primarySystem?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePropertyInput(input: CreatePropertyInput): CreatePropertyInput {
  return {
    ...input,
    name: input.name.trim(),
    customer: input.customer.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    primarySystem: input.primarySystem.trim(),
  };
}

function validatePropertyInput(input: CreatePropertyInput) {
  if (!input.name) throw new Error("Property name is required.");
  if (!input.customer) throw new Error("Customer is required.");
  if (!input.address) throw new Error("Address is required.");
  if (!input.city) throw new Error("City is required.");
}

async function resolveLocation(
  address: string,
  city: string,
): Promise<{ location: PropertyLocation | undefined; geocoded: boolean }> {
  try {
    const result = await geocodeAddress(`${address}, ${city}`);
    if (result.success) {
      return { location: result.location, geocoded: true };
    }
  } catch {
    // geocoding failure is non-fatal
  }
  return { location: undefined, geocoded: false };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listProperties(contextInput?: SessionRepositoryContextInput) {
  return listPropertyRecords(contextInput);
}

export async function listPropertiesForCustomer(customerId: string): Promise<Property[]> {
  return listPropertiesByCustomerId(customerId);
}

export async function getProperty(
  id: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<Property | null> {
  return getPropertyById(id, contextInput);
}

export async function resolvePropertyIdByName(
  name: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<string | null> {
  return resolvePropertyIdByNameRecord(name, contextInput);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createProperty(
  input: CreatePropertyInput,
  contextInput?: SessionRepositoryContextInput,
): Promise<PropertyMutationResult> {
  const normalized = normalizePropertyInput(input);
  validatePropertyInput(normalized);

  const { location, geocoded } = await resolveLocation(normalized.address, normalized.city);

  const property = await createPropertyRecord(
    {
      ...normalized,
      openJobs: normalized.openJobs ?? 0,
      lastVisit: normalized.lastVisit ?? new Date().toISOString().slice(0, 10),
      location,
    },
    contextInput,
  );

  const customerId = await resolveCustomerIdByName(property.customer, contextInput);
  if (customerId) await syncCustomerCounters(customerId);

  return {
    property,
    geocodeStatus: geocoded ? "geocoded" : "geocode_failed_location_preserved",
  };
}

export async function updateProperty(
  id: string,
  input: UpdatePropertyInput,
  contextInput?: SessionRepositoryContextInput,
): Promise<PropertyMutationResult | null> {
  const shouldGeocode = input.address !== undefined || input.city !== undefined;
  let geocodeStatus: GeocodeStatus = "no_geocode";
  let locationUpdate: { location: PropertyLocation } | undefined;

  if (shouldGeocode) {
    const existing = await getPropertyById(id, contextInput);
    if (!existing) return null;

    const address = input.address ?? existing.address;
    const city = input.city ?? existing.city;
    const { location: resolved, geocoded } = await resolveLocation(address, city);

    if (geocoded && resolved) {
      locationUpdate = { location: resolved };
      geocodeStatus = "geocoded";
    } else {
      geocodeStatus = "geocode_failed_location_preserved";
      // Don't clear existing location when geocoding fails
    }
  }

  const property = await updatePropertyRecord(
    id,
    { ...input, ...locationUpdate },
    contextInput,
  );

  if (!property) return null;

  if (input.customer !== undefined) {
    const customerId = await resolveCustomerIdByName(input.customer, contextInput);
    if (customerId) await syncCustomerCounters(customerId);
  }

  return { property, geocodeStatus };
}

export async function deleteProperty(
  id: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<boolean> {
  const existing = await getPropertyById(id, contextInput);
  const deleted = await deletePropertyRecord(id, contextInput);

  if (deleted && existing?.customerId) {
    await syncCustomerCounters(existing.customerId);
  }

  return deleted;
}

export async function syncPropertyCounters(
  propertyId: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<void> {
  const openJobs = await countOpenJobsForProperty(propertyId, contextInput);
  await updatePropertyRecord(propertyId, { openJobs }, contextInput);
}