import "server-only";

import { randomUUID } from "node:crypto";

import type { LedgerCommand, LedgerEntry, LedgerFilters, StockLevel } from "@/features/inventory/types/ledger";
import { expandLedgerCommand, LedgerRuleError } from "@/features/inventory/utils/ledgerRules";
import { getItem } from "@/repositories/catalog";
import {
  appendLedgerRows,
  getOnHand,
  getTransactionWithGroup,
  listStockLevels as listStockLevelRecords,
  listTransactions as listTransactionRecords,
} from "@/repositories/inventoryLedger";
import { getLocation } from "@/repositories/inventoryLocations";

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

export async function listLedger(filters: LedgerFilters = {}): Promise<LedgerEntry[]> {
  return listTransactionRecords(filters);
}

/** Friendly pre-checks; the database guard trigger is the real authority. */
async function assertStockableItem(itemId: string): Promise<void> {
  const item = await getItem(itemId);
  if (!item) notFound("Item");
  if (!item.isStockable) badRequest(`"${item.name}" is not a stockable item.`);
  if (!item.isActive) badRequest(`"${item.name}" is inactive.`);
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
    await assertStockableItem(command.itemId);
    await assertActiveLocation(command.locationId);
  }

  const currentOnHand = command.kind === "count" ? await getOnHand(command.itemId, command.locationId) : undefined;
  const rows = expandLedgerCommand(command, { newTransferGroupId: randomUUID, currentOnHand });
  if (rows.length === 0) return { entries: [], noChange: true };
  return { entries: await appendLedgerRows(rows, userId), noChange: false };
}
