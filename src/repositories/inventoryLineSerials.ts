import "server-only";

import type { LineSerialPick, SerialUnitStatus } from "@/features/inventory/types/serials";

import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

interface PickRow {
  line_id: string;
  serial_unit_id: string;
  inventory_serial_units: {
    serial_number: string;
    location_id: string | null;
    status: string;
  } | null;
}

const PICK_COLUMNS = "line_id,serial_unit_id,inventory_serial_units(serial_number,location_id,status)";

function mapPick(row: PickRow): LineSerialPick | null {
  if (!row.inventory_serial_units) return null;
  return {
    lineId: row.line_id,
    serialUnitId: row.serial_unit_id,
    serialNumber: row.inventory_serial_units.serial_number,
    locationId: row.inventory_serial_units.location_id,
    status: row.inventory_serial_units.status as SerialUnitStatus,
  };
}

/** The units picked for these material lines. Lines with none are simply absent. */
export async function listLinePicks(lineIds: readonly string[]): Promise<LineSerialPick[]> {
  if (lineIds.length === 0) return [];
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_line_serials")
    .select(PICK_COLUMNS)
    .eq("org_id", orgId)
    .in("line_id", [...lineIds])
    .order("created_at", { ascending: true });
  if (error) throwInventoryDbError(error);
  return ((data ?? []) as unknown as PickRow[]).map(mapPick).filter((pick): pick is LineSerialPick => pick !== null);
}

/**
 * Picks a unit for a line. The database guard refuses a unit that is not in stock, is
 * flagged, is not the line's item, or would overfill the line (400 with its message);
 * a unit already picked for a line conflicts (409).
 */
export async function createLinePick(lineId: string, serialUnitId: string, userId: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("job_material_line_serials")
    .insert({ org_id: orgId, line_id: lineId, serial_unit_id: serialUnitId, created_by: userId });
  if (error) throwInventoryDbError(error, "That unit is already picked for a material line. Release it there first.");
}

/** Releases a unit from the line it was picked for. Returns false when it was not picked. */
export async function deleteLinePick(serialUnitId: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_line_serials")
    .delete()
    .eq("org_id", orgId)
    .eq("serial_unit_id", serialUnitId)
    .select("id");
  if (error) throwInventoryDbError(error);
  return (data ?? []).length > 0;
}

/** Which of these units are already picked for some line. */
export async function listPickedUnitIds(unitIds: readonly string[]): Promise<Set<string>> {
  if (unitIds.length === 0) return new Set();
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_line_serials")
    .select("serial_unit_id")
    .eq("org_id", orgId)
    .in("serial_unit_id", [...unitIds]);
  if (error) throwInventoryDbError(error);
  return new Set(((data ?? []) as Array<{ serial_unit_id: string }>).map((row) => row.serial_unit_id));
}
