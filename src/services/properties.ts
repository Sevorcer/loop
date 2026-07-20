/**
 * Server-only property service.
 *
 * Handles property create and update operations with automatic geocoding.
 */

import "server-only";

import type {
  Property,
  PropertyLocation,
  PropertyStatus,
  PropertyType,
} from "@/features/properties/types/property";
import { formatPropertyAddress } from "@/features/properties/utils/formatPropertyAddress";
import {
  countOpenJobsForProperty,
  createProperty as createPropertyRecord,
  deleteProperty as deletePropertyRecord,
  getPropertyById,
  listProperties as listPropertyRecords,
  resolveCustomerIdByName,
  updateProperty as updatePropertyRecord,
} from "@/repositories/properties";
import { syncCustomerCounters } from "@/services/customers";

import { geocodeAddress } from "./geocoding";

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

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

export type GeocodeStatus =
  | "geocoded"
  | "geocode_failed_location_preserved"
  | "location_unchanged"
  | "no_location";

export interface CreatePropertyResult {
  property: Property;
  geocodeStatus: GeocodeStatus;
}

export interface UpdatePropertyResult {
  property: Property;
  geocodeStatus: GeocodeStatus;
}

const PROPERTY_TYPES = new Set<PropertyType>([
  "Residential",
  "Commercial",
  "Multi-Family",
]);
const PROPERTY_STATUSES = new Set<PropertyStatus>(["Active", "Pending", "Inactive"]);

function normalizePropertyInput(input: CreatePropertyInput): CreatePropertyInput {
  return {
    ...input,
    name: input.name.trim(),
    customer: input.customer.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    primarySystem: input.primarySystem.trim(),
    lastVisit: input.lastVisit?.trim(),
  };
}

function validatePropertyInput(input: CreatePropertyInput) {
  if (!input.name) throw new Error("Property name is required.");
  if (!input.customer) throw new Error("Customer name is required.");
  if (!input.address) throw new Error("Address is required.");
  if (!input.city) throw new Error("City is required.");
  if (!input.primarySystem) throw new Error("Primary system is required.");
  if (!PROPERTY_TYPES.has(input.type)) throw new Error("Invalid property type.");
  if (!PROPERTY_STATUSES.has(input.status)) throw new Error("Invalid property status.");
}

async function resolveLocation(
  address: string,
  city: string,
): Promise<{ location: PropertyLocation | undefined; geocoded: boolean }> {
  const fullAddress = formatPropertyAddress({ address, city });
  const result = await geocodeAddress(fullAddress);

  if (!result.success) {
    console.warn(
      `[properties] Geocoding failed for "${fullAddress}": ${result.error}`,
    );
    return { location: undefined, geocoded: false };
  }

  return { location: result.location, geocoded: true };
}

export async function listProperties() {
  return listPropertyRecords();
}

export async function fetchPropertyById(id: string) {
  return getPropertyById(id);
}

export async function resolvePropertyIdByName(propertyName: string): Promise<string | null> {
  const properties = await listPropertyRecords();
  const matched = properties.find(
    (property) => property.name.toLowerCase() === propertyName.trim().toLowerCase(),
  );
  return matched?.id ?? null;
}

export async function syncPropertyCounters(propertyId: string) {
  const property = await getPropertyById(propertyId);

  if (!property) {
    return null;
  }

  return updatePropertyRecord(propertyId, {
    openJobs: await countOpenJobsForProperty(propertyId),
    customer: property.customer,
  });
}

export async function createProperty(
  input: CreatePropertyInput,
): Promise<CreatePropertyResult> {
  const normalized = normalizePropertyInput(input);
  validatePropertyInput(normalized);

  const { location, geocoded } = await resolveLocation(
    normalized.address,
    normalized.city,
  );

  const property = await createPropertyRecord({
    ...normalized,
    openJobs: normalized.openJobs ?? 0,
    lastVisit: normalized.lastVisit ?? new Date().toISOString().slice(0, 10),
    location,
  });

  const customerId = await resolveCustomerIdByName(property.customer);
  if (customerId) {
    await syncCustomerCounters(customerId);
  }

  return {
    property,
    geocodeStatus: geocoded ? "geocoded" : "no_location",
  };
}

export async function updateProperty(
  existing: Property,
  changes: UpdatePropertyInput,
): Promise<UpdatePropertyResult> {
  const merged = normalizePropertyInput({
    name: changes.name ?? existing.name,
    customer: changes.customer ?? existing.customer,
    address: changes.address ?? existing.address,
    city: changes.city ?? existing.city,
    type: changes.type ?? existing.type,
    status: changes.status ?? existing.status,
    primarySystem: changes.primarySystem ?? existing.primarySystem,
    openJobs: changes.openJobs ?? existing.openJobs,
    lastVisit: changes.lastVisit ?? existing.lastVisit,
  });

  validatePropertyInput(merged);

  const addressChanged =
    (changes.address !== undefined && changes.address !== existing.address) ||
    (changes.city !== undefined && changes.city !== existing.city);

  let location = existing.location;
  let geocodeStatus: GeocodeStatus = "location_unchanged";

  if (addressChanged) {
    const resolved = await resolveLocation(
      changes.address ?? existing.address,
      changes.city ?? existing.city,
    );

    if (resolved.geocoded) {
      location = resolved.location;
      geocodeStatus = "geocoded";
    } else {
      location = existing.location;
      geocodeStatus = existing.location
        ? "geocode_failed_location_preserved"
        : "no_location";
    }
  }

  const property = await updatePropertyRecord(existing.id, {
    ...merged,
    location,
  });

  if (!property) {
    throw new Error(`Property '${existing.id}' not found.`);
  }

  const [previousCustomerId, nextCustomerId] = await Promise.all([
    resolveCustomerIdByName(existing.customer),
    resolveCustomerIdByName(property.customer),
  ]);

  if (previousCustomerId) {
    await syncCustomerCounters(previousCustomerId);
  }

  if (nextCustomerId && nextCustomerId !== previousCustomerId) {
    await syncCustomerCounters(nextCustomerId);
  }

  await syncPropertyCounters(property.id);

  return { property, geocodeStatus };
}

export async function deleteProperty(id: string) {
  const existing = await getPropertyById(id);
  const deleted = await deletePropertyRecord(id);

  if (deleted && existing) {
    const customerId = await resolveCustomerIdByName(existing.customer);
    if (customerId) {
      await syncCustomerCounters(customerId);
    }
  }

  return deleted;
}
