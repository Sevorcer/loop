import type { SessionRepositoryContextInput } from "@/repositories/supabaseContext";

// Thread context into all repository calls:
export async function listProperties(contextInput?: SessionRepositoryContextInput) {
  return listPropertyRecords(contextInput);
}

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