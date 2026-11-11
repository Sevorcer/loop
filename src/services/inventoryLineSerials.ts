import "server-only";

import type { LineSerialPick } from "@/features/inventory/types/serials";
import { createLinePick, deleteLinePick, listLinePicks, listPickedUnitIds } from "@/repositories/inventoryLineSerials";
import { listSerialUnits } from "@/repositories/inventorySerialUnits";

export async function listPicksForLines(lineIds: readonly string[]): Promise<LineSerialPick[]> {
  return listLinePicks(lineIds);
}

/** Picks a unit for a material line. The database enforces item, stock status, review flag and quantity. */
export async function pickUnitForLine(lineId: string, serialUnitId: string, userId: string): Promise<void> {
  if (!userId) throw Object.assign(new Error("Authenticated user is required."), { status: 401 });
  await createLinePick(lineId, serialUnitId, userId);
}

export async function releaseUnit(serialUnitId: string): Promise<void> {
  const released = await deleteLinePick(serialUnitId);
  if (!released) throw Object.assign(new Error("That unit is not picked for a line."), { status: 404 });
}

export interface PickableUnit {
  id: string;
  serialNumber: string;
}

/**
 * In-stock units of one item that can be picked now: not flagged for review and not
 * already picked for a line. Sorted by serial so the list reads the same every time.
 */
export async function listPickableUnits(itemId: string, limit = 200): Promise<PickableUnit[]> {
  const units = await listSerialUnits({ itemId, status: "in_stock", needsReview: false, limit });
  const taken = await listPickedUnitIds(units.map((unit) => unit.id));
  return units
    .filter((unit) => !taken.has(unit.id))
    .map((unit) => ({ id: unit.id, serialNumber: unit.serialNumber }))
    .sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
}
