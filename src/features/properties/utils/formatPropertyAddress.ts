import { joinAddressParts } from "@/lib/address";

import type { Property } from "../types/property";

export type PropertyAddress = Pick<Property, "address" | "city">;

/**
 * Property address shown on cards, lists, and the location copied onto a job.
 * Blank street or city parts are left out.
 */
export function formatPropertyAddress({
  address,
  city,
}: PropertyAddress): string {
  return joinAddressParts([address, city]);
}
