import type { JobPropertyOption } from "@/features/jobs/utils/smartJobCreation";

export interface RecordSearchOption {
  id: string;
  name: string;
  detail?: string;
}

export function filterRecordOptions(options: RecordSearchOption[], query: string): RecordSearchOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((option) => {
    const haystack = `${option.name} ${option.detail ?? ""}`.toLowerCase();
    return haystack.includes(needle);
  });
}

export interface PropertyDraft {
  name: string;
  address: string;
  city: string;
}

export function propertiesForCustomer<T extends { customerId?: string | null }>(
  properties: T[],
  customerId?: string | null,
): T[] {
  if (!customerId) return [];
  return properties.filter((property) => property.customerId === customerId);
}

export function propertiesMatchingQuery<
  T extends { name: string; address?: string | null; city?: string | null },
>(properties: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return properties;
  return properties.filter((property) => {
    const haystack = [property.name, property.address, property.city]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function propertyOptionDetail(
  property: Pick<JobPropertyOption, "address" | "city">,
): string {
  const address = property.address?.trim() ?? "";
  const city = property.city?.trim() ?? "";
  if (address && city) return `${address}, ${city}`;
  return address || city;
}

export function missingPropertyDraftFields(draft: PropertyDraft): string[] {
  const missing: string[] = [];
  if (!draft.name.trim()) missing.push("Property name");
  if (!draft.address.trim()) missing.push("Street address");
  if (!draft.city.trim()) missing.push("City");
  return missing;
}

export function formatMissingPropertyDraft(fields: string[]): string | null {
  if (fields.length === 0) return null;
  return `Add the missing information: ${fields.join(", ")}.`;
}
