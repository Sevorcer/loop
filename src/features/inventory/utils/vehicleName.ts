/**
 * Display rule for vehicle names (Lane 1, after M4).
 *
 * The linked `vehicles` row is the only source of a van name. The legacy text
 * columns (`crews.truck_name`, `vehicle_alerts.vehicle_name`) were retired in
 * M4, so a crew with no van linked has an empty name (callers show "—" /
 * "No truck on file").
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

export function resolveVehicleName(linked: LinkedVehicleEmbed): string {
  const one = Array.isArray(linked) ? linked[0] : linked;
  return one?.name?.trim() ?? "";
}

/** PostgREST embed for a crew's linked vehicle. The FK name keeps the embed unambiguous. */
export const CREW_VEHICLE_EMBED = "vehicle_id,vehicle:vehicles!crews_vehicle_same_org_fkey(name)";

/** PostgREST embed for an alert's linked vehicle. */
export const ALERT_VEHICLE_EMBED = "vehicle_id,vehicle:vehicles!vehicle_alerts_vehicle_same_org_fkey(name)";
