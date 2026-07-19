import type { Property } from "../types/property";

export type PropertyAddress = Pick<Property, "address" | "city">;

/**
 * Canonical property address used for display, navigation fallback, and
 * geocoding requests. Provider-enriched location data should derive from this.
 */
export function formatPropertyAddress({
  address,
  city,
}: PropertyAddress): string {
  return `${address}, ${city}`;
}
