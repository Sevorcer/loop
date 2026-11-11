import "server-only";

import type {
  SerialReviewRow,
  SerialUnit,
  SerialUnitFilters,
} from "@/features/inventory/types/serials";
import { parseReviewCommand, replaceSerialInList, serialKey } from "@/features/inventory/utils/serialRules";
import { getInstalledSystemSerials, setInstalledSystemSerials } from "@/repositories/installedSystems";
import {
  clearSerialUnitReview,
  getSerialUnit,
  listSerialReviewQueue,
  listSerialUnits as listSerialUnitRecords,
} from "@/repositories/inventorySerialUnits";

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function notFound(what: string): never {
  throw Object.assign(new Error(`${what} not found.`), { status: 404 });
}

export async function listSerialUnits(filters: SerialUnitFilters = {}): Promise<SerialUnit[]> {
  return listSerialUnitRecords(filters);
}

export async function listSerialReview(): Promise<SerialReviewRow[]> {
  return listSerialReviewQueue();
}

/** The systems a review command would change, so the route can check that permission too. */
export function reviewCommandChangesSystem(body: unknown): boolean {
  const parsed = parseReviewCommand(body);
  return parsed.ok && parsed.command.action !== "keep";
}

/**
 * Settles one flagged serial unit. Nothing is guessed: the office decides.
 *
 *   keep     this unit really holds the serial. Conflicts (409) while another
 *            unit already holds it.
 *   correct  the serial on this system was wrong; save the nameplate value.
 *   remove   the system should not carry this serial.
 *
 * correct and remove edit the system's serial list. The database reconciles the
 * units, and a duplicate group that shrinks to one row stops needing review.
 */
export async function resolveSerialReview(unitId: string, body: unknown): Promise<SerialUnit[]> {
  const parsed = parseReviewCommand(body);
  if (!parsed.ok) badRequest(parsed.message);
  const { command } = parsed;

  const unit = await getSerialUnit(unitId);
  if (!unit) notFound("Serial unit");
  if (!unit.needsReview) badRequest("This unit is not waiting for review.");

  if (command.action === "keep") {
    const kept = await clearSerialUnitReview(unitId);
    if (!kept) notFound("Serial unit");
    return [kept];
  }

  const systemId = unit.installedSystemId;
  if (!systemId) badRequest("This unit is not attached to a system, so there is no serial list to change.");

  const replacement = command.action === "correct" ? (command.serialNumber ?? null) : null;
  if (replacement !== null && serialKey(replacement) === serialKey(unit.serialNumber)) {
    badRequest("That is already the serial on this system.");
  }

  const current = await getInstalledSystemSerials(systemId);
  if (current === null) notFound("Installed system");

  const saved = await setInstalledSystemSerials(systemId, replaceSerialInList(current, unit.serialNumber, replacement));
  if (saved === null) notFound("Installed system");

  return listSerialUnitRecords({ installedSystemId: systemId });
}
