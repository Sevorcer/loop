/**
 * Office count sheet for one van.
 *
 * A blank line is not sent. A typed quantity equal to on-hand expands to no
 * ledger row (the count command already skips a zero delta, and qty_delta
 * cannot be zero). Pars are listed first so the truck's targets are counted
 * before the rest of the catalog. Cost is never part of this payload.
 */

import type { NewLedgerRow } from "../types/ledger";
import { expandLedgerCommand } from "./ledgerRules";

export const INITIAL_COUNT_REASON = "Initial count-in";
export const OFFICE_RECOUNT_REASON = "Recount";

const MAX_LINES = 500;
const MAX_REASON = 500;

export interface CountSheetItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  onHand: number;
  minQty: number | null;
  maxQty: number | null;
}

/** Stockable items with a minimum or fill-to come first, then the rest, by name. */
export function orderCountSheet(items: readonly CountSheetItem[]): CountSheetItem[] {
  return [...items].sort((a, b) => {
    const aPar = a.minQty != null || a.maxQty != null;
    const bPar = b.minQty != null || b.maxQty != null;
    if (aPar !== bPar) return aPar ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** The note stored on each count row. A blank note uses the count-in or recount default. */
export function resolveCountReason(explicit: string | null | undefined, counted: boolean): string {
  const trimmed = (explicit ?? "").trim();
  if (trimmed.length > MAX_REASON) {
    throw Object.assign(new Error("Keep the note under 500 characters."), { status: 400 });
  }
  if (trimmed) return trimmed;
  return counted ? OFFICE_RECOUNT_REASON : INITIAL_COUNT_REASON;
}

export interface CountLine {
  itemId: string;
  countedQty: number;
}

export interface ParsedCountBody {
  lines: CountLine[];
  reason: string | null;
  problems: string[];
}

function countedQty(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < 0) return undefined;
  if (Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-6) return undefined;
  return value;
}

export function parseCountBody(body: Record<string, unknown>): ParsedCountBody {
  const problems: string[] = [];
  const reason = typeof body.reason === "string" ? body.reason : null;
  if (reason && reason.trim().length > MAX_REASON) problems.push("Keep the note under 500 characters.");

  if (!Array.isArray(body.lines)) {
    return { lines: [], reason, problems: [...problems, "lines must be a list."] };
  }
  if (body.lines.length === 0) problems.push("Type a quantity on at least one line.");
  if (body.lines.length > MAX_LINES) problems.push("Count fewer lines at a time.");

  const lines: CountLine[] = [];
  const seen = new Set<string>();
  for (const entry of body.lines) {
    if (!entry || typeof entry !== "object") {
      problems.push("Each line needs an item and a counted quantity.");
      continue;
    }
    const record = entry as Record<string, unknown>;
    const itemId = typeof record.itemId === "string" ? record.itemId.trim() : "";
    if (!itemId) {
      problems.push("Each line needs an item.");
      continue;
    }
    if (seen.has(itemId)) {
      problems.push("Each item can only be counted once.");
      continue;
    }
    seen.add(itemId);
    const qty = countedQty(record.countedQty);
    if (qty === undefined) {
      problems.push("A count is 0 or more, with at most 3 decimals.");
      continue;
    }
    lines.push({ itemId, countedQty: qty });
  }

  return { lines, reason, problems };
}

/**
 * Expands each typed count through the existing count command.
 * A line that matches on-hand is skipped and does not become a row.
 */
export function expandOfficeCount(args: {
  locationId: string;
  reason: string;
  lines: readonly CountLine[];
  onHandByItem: ReadonlyMap<string, number>;
}): { rows: NewLedgerRow[]; skippedItemIds: string[] } {
  const rows: NewLedgerRow[] = [];
  const skippedItemIds: string[] = [];
  for (const line of args.lines) {
    const expanded = expandLedgerCommand(
      {
        kind: "count",
        itemId: line.itemId,
        locationId: args.locationId,
        countedQty: line.countedQty,
        reason: args.reason,
      },
      { newTransferGroupId: () => "unused", currentOnHand: args.onHandByItem.get(line.itemId) ?? 0 },
    );
    if (expanded.length === 0) skippedItemIds.push(line.itemId);
    else rows.push(...expanded);
  }
  for (const row of rows) {
    if (row.unitCostCents != null) {
      throw Object.assign(new Error("A count does not carry cost."), { status: 400 });
    }
  }
  return { rows, skippedItemIds };
}
