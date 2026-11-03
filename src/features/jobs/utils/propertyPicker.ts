import type { JobPropertyOption } from "@/features/jobs/utils/smartJobCreation";
import { joinAddressParts } from "@/lib/address";

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
  return joinAddressParts([property.address, property.city]);
}

export function missingPropertyDraftFields(draft: PropertyDraft): string[] {
  // Name-only record creation (Collin's standing rule, 2026-10-01): the inline
  // property-draft path only requires a name, matching the inline customer path.
  // Street and city stay optional here. The standalone NewPropertyForm keeps its
  // own address requirement for direct property creation.
  const missing: string[] = [];
  if (!draft.name.trim()) missing.push("Property name");
  return missing;
}

export function formatMissingPropertyDraft(fields: string[]): string | null {
  if (fields.length === 0) return null;
  return `Add the missing information: ${fields.join(", ")}.`;
}
