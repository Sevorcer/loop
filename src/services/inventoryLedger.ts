import "server-only";

import { randomUUID } from "node:crypto";

import type { LedgerCommand, LedgerEntry, LedgerFilters, StockLevel } from "@/features/inventory/types/ledger";
import { expandLedgerCommand, LedgerRuleError } from "@/features/inventory/utils/ledgerRules";
import { checkReceiveSerials } from "@/features/inventory/utils/serialRules";
import { getItem } from "@/repositories/catalog";
import {
  appendLedgerRows,
  getOnHand,
  getTransactionWithGroup,
  listCountedLocationIds as listCountedLocationIdRecords,
  listStockLevels as listStockLevelRecords,
  listTransactions as listTransactionRecords,
} from "@/repositories/inventoryLedger";
import { getLocation } from "@/repositories/inventoryLocations";
import { createReceivedUnits, discardUnits } from "@/repositories/inventorySerialUnits";

import { reconcileAfterStockChange } from "./inventoryReservations";

export { LedgerRuleError };

function notFound(what: string): never {
  throw Object.assign(new Error(`${what} not found.`), { status: 404 });
}

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

export async function listStockLevels(filters: { locationId?: string; itemId?: string } = {}): Promise<StockLevel[]> {
  return listStockLevelRecords(filters);
}

export async function listCountedLocationIds(locationIds: readonly string[]): Promise<Set<string>> {
  return listCountedLocationIdRecords(locationIds);
}

export async function listLedger(filters: LedgerFilters = {}): Promise<LedgerEntry[]> {
  return listTransactionRecords(filters);
}

/** Friendly pre-checks; the database guard trigger is the real authority. */
async function assertStockableItem(itemId: string) {
  const item = await getItem(itemId);
  if (!item) notFound("Item");
  if (!item.isStockable) badRequest(`"${item.name}" is not a stockable item.`);
  if (!item.isActive) badRequest(`"${item.name}" is inactive.`);
  return item;
}

async function assertActiveLocation(locationId: string): Promise<void> {
  const location = await getLocation(locationId);
  if (!location) notFound("Location");
  if (!location.isActive) badRequest(`"${location.name}" is inactive.`);
}

export interface PostLedgerResult {
  entries: LedgerEntry[];
  /** True when a count matched on-hand and nothing was posted. */
  noChange: boolean;
}

/**
 * Posts one ledger command. Quantity changes only by appending rows; stock
 * levels are updated by the database trigger. Nothing here blocks on stock
 * level (negative on-hand is allowed; the UI warns).
 */
export async function postLedgerCommand(command: LedgerCommand, userId: string): Promise<PostLedgerResult> {
  const result = await postCommand(command, userId);
  // Stock changed: jobs waiting on these items are topped up in date order and
  // readiness is refreshed. Quiet by design: the ledger post has already succeeded.
  if (result.entries.length > 0) {
    await reconcileAfterStockChange([...new Set(result.entries.map((entry) => entry.itemId))]);
  }
  return result;
}

async function postCommand(command: LedgerCommand, userId: string): Promise<PostLedgerResult> {
  if (!userId) throw Object.assign(new Error("Authenticated user is required."), { status: 401 });

  if (command.kind === "reverse") {
    const originals = await getTransactionWithGroup(command.transactionId);
    if (originals.length === 0) notFound("Ledger entry");
    const rows = expandLedgerCommand(command, { newTransferGroupId: randomUUID, originals });
    return { entries: await appendLedgerRows(rows, userId), noChange: false };
  }

  if (command.kind === "transfer") {
    await assertStockableItem(command.itemId);
    await Promise.all([assertActiveLocation(command.fromLocationId), assertActiveLocation(command.toLocationId)]);
  } else {
    const item = await assertStockableItem(command.itemId);
    await assertActiveLocation(command.locationId);
    if (command.kind === "receive") {
      if (item.trackingMode === "serialized") return receiveSerialized(command, item, userId);
      if (command.serialNumbers && command.serialNumbers.length > 0) {
        badRequest(`"${item.name}" is counted by quantity, so it does not take serial numbers.`);
      }
    }
  }

  const currentOnHand = command.kind === "count" ? await getOnHand(command.itemId, command.locationId) : undefined;
  const rows = expandLedgerCommand(command, { newTransferGroupId: randomUUID, currentOnHand });
  if (rows.length === 0) return { entries: [], noChange: true };
  return { entries: await appendLedgerRows(rows, userId), noChange: false };
}

/**
 * Receives a serialized item: one unit and one ledger entry (quantity 1) per serial.
 * Units are created first (one statement, so a duplicate serial leaves nothing behind),
 * then the entries that point at them are appended in one statement. If the ledger post
 * fails, the new units are discarded where the role allows it; otherwise they stay
 * in stock with no ledger entry and show up on the next count.
 */
async function receiveSerialized(
  command: Extract<LedgerCommand, { kind: "receive" }>,
  item: { id: string; name: string; brand: string | null; model: string | null; mfrPartNumber: string | null },
  userId: string,
): Promise<PostLedgerResult> {
  const checked = checkReceiveSerials(command.serialNumbers);
  if (!checked.ok) badRequest(`"${item.name}" is tracked by serial number. ${checked.message}`);
  if (command.qty !== undefined && command.qty !== checked.serials.length) {
    badRequest(`Quantity (${command.qty}) does not match the ${checked.serials.length} serial numbers entered.`);
  }

  const units = await createReceivedUnits(
    checked.serials.map((serialNumber) => ({
      itemId: item.id,
      locationId: command.locationId,
      manufacturer: item.brand ?? "",
      modelNumber: item.model ?? item.mfrPartNumber ?? "",
      serialNumber,
    })),
    userId,
  );

  const reason = (command.reason ?? "").trim() || null;
  try {
    const entries = await appendLedgerRows(
      units.map((unit) => ({
        txnType: "receive" as const,
        itemId: item.id,
        locationId: command.locationId,
        qtyDelta: 1,
        unitCostCents: command.unitCostCents ?? null,
        reason,
        serialUnitId: unit.id,
      })),
      userId,
    );
    return { entries, noChange: false };
  } catch (error) {
    await discardUnits(units.map((unit) => unit.id));
    throw error;
  }
}
