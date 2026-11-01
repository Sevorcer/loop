import { joinAddressParts } from "@/lib/address";

import type { Property } from "../types/property";

export type PropertyAddress = Pick<Property, "address" | "city"> &
  Partial<Pick<Property, "state" | "zip">>;

/**
 * Property address shown on cards, lists, and the location copied onto a job.
 * Blank street, city, state, or zip parts are left out.
 */
export function formatPropertyAddress({
  address,
  city,
  state,
  zip,
}: PropertyAddress): string {
  return joinAddressParts([address, city, state, zip]);
}
