/**
 * Office restock post.
 *
 * Each checked line is one existing transfer command: shop out, van in,
 * its own transfer group, reason Restock. There is no restock list table
 * and no second received step. Cost is not accepted and is not written.
 */

import type { NewLedgerRow } from "../types/ledger";
import { expandLedgerCommand, isValidQty } from "./ledgerRules";

export const RESTOCK_REASON = "Restock";

const MAX_LINES = 500;

export interface RestockPostLine {
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  qty: number;
}

export interface ParsedRestockBody {
  lines: RestockPostLine[];
  problems: string[];
}

function id(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseRestockBody(body: Record<string, unknown>): ParsedRestockBody {
  const problems: string[] = [];
  if (!Array.isArray(body.lines)) {
    return { lines: [], problems: ["lines must be a list."] };
  }
  if (body.lines.length === 0) problems.push("Check at least one line to pull.");
  if (body.lines.length > MAX_LINES) problems.push("Pull fewer lines at a time.");

  const lines: RestockPostLine[] = [];
  const seen = new Set<string>();
  for (const entry of body.lines) {
    if (!entry || typeof entry !== "object") {
      problems.push("Each line needs an item, a shop, a van, and a quantity.");
      continue;
    }
    const record = entry as Record<string, unknown>;
    const itemId = id(record.itemId);
    const fromLocationId = id(record.fromLocationId);
    const toLocationId = id(record.toLocationId);
    if (!itemId || !fromLocationId || !toLocationId) {
      problems.push("Each line needs an item, a shop, and a van.");
      continue;
    }
    const key = `${itemId}:${toLocationId}`;
    if (seen.has(key)) {
      problems.push("Each item can only be pulled once onto the same van.");
      continue;
    }
    seen.add(key);
    const qty = record.qty;
    if (!isValidQty(qty)) {
      problems.push("A pull quantity must be greater than zero, with at most 3 decimals.");
      continue;
    }
    lines.push({ itemId, fromLocationId, toLocationId, qty });
  }

  return { lines, problems };
}

/**
 * One transfer pair per line. The caller supplies a fresh group id per line
 * so reversing one part does not undo the rest of the pull.
 */
export function expandOfficeRestock(
  lines: readonly RestockPostLine[],
  newTransferGroupId: () => string,
): NewLedgerRow[] {
  const rows: NewLedgerRow[] = [];
  const groups = new Set<string>();
  for (const line of lines) {
    const groupId = newTransferGroupId();
    if (!groupId || groups.has(groupId)) {
      throw Object.assign(new Error("Each restock line needs its own transfer group."), { status: 400 });
    }
    groups.add(groupId);
    const pair = expandLedgerCommand(
      {
        kind: "transfer",
        itemId: line.itemId,
        fromLocationId: line.fromLocationId,
        toLocationId: line.toLocationId,
        qty: line.qty,
        reason: RESTOCK_REASON,
      },
      { newTransferGroupId: () => groupId },
    );
    if (pair.length !== 2 || pair[0]?.transferGroupId !== groupId || pair[1]?.transferGroupId !== groupId) {
      throw Object.assign(new Error("A restock line must post as a transfer pair."), { status: 400 });
    }
    if (pair.some((row) => row.unitCostCents != null || row.jobId)) {
      throw Object.assign(new Error("A restock does not carry cost or a job."), { status: 400 });
    }
    rows.push(...pair);
  }
  return rows;
}
