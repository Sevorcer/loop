/**
 * Expand-phase display rule for vehicle names (Lane 1, M3 -> M4).
 *
 * A linked vehicle is the source of truth. Until M4 retires the legacy text
 * columns (`crews.truck_name`, `vehicle_alerts.vehicle_name`), rows that were
 * never linked fall back to their old text so nothing goes blank.
 */

export interface LinkedVehicleName {
  name: string | null;
}

/**
 * A PostgREST embed of a many-to-one link is a single object at runtime, but
 * supabase-js types it as an array when the select string is a literal. Accept
 * both so the type system and the wire format cannot disagree.
 */
export type LinkedVehicleEmbed = LinkedVehicleName | LinkedVehicleName[] | null | undefined;

export function resolveVehicleName(
  linked: LinkedVehicleEmbed,
  legacyText: string | null | undefined,
): string {
  const one = Array.isArray(linked) ? linked[0] : linked;
  const fromVehicle = one?.name?.trim();
  if (fromVehicle) return fromVehicle;
  return legacyText?.trim() ?? "";
}

/** PostgREST embed for a crew's linked vehicle. The FK name disambiguates vehicles.crew_id <-> crews. */
export const CREW_VEHICLE_EMBED = "vehicle_id,vehicle:vehicles!crews_vehicle_same_org_fkey(name)";

/** PostgREST embed for an alert's linked vehicle. */
export const ALERT_VEHICLE_EMBED = "vehicle_id,vehicle:vehicles!vehicle_alerts_vehicle_same_org_fkey(name)";
