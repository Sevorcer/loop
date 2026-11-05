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

export function resolveVehicleName(
  linked: LinkedVehicleName | null | undefined,
  legacyText: string | null | undefined,
): string {
  const fromVehicle = linked?.name?.trim();
  if (fromVehicle) return fromVehicle;
  return legacyText?.trim() ?? "";
}

/** PostgREST embed for a crew's linked vehicle. The FK name disambiguates vehicles.crew_id <-> crews. */
export const CREW_VEHICLE_EMBED = "vehicle_id,vehicle:vehicles!crews_vehicle_same_org_fkey(name)";

/** PostgREST embed for an alert's linked vehicle. */
export const ALERT_VEHICLE_EMBED = "vehicle_id,vehicle:vehicles!vehicle_alerts_vehicle_same_org_fkey(name)";
