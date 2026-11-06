/**
 * Tech van posts for My van.
 *
 * Counts and shop-to-own-van transfers only. The JSON is the contract for
 * fn_inventory_post_van_entries. Cost, job, transfer group, reversal, and
 * author are never set. Adjust is not a shape this builder can produce.
 */

import { RESTOCK_REASON } from "./restockPost";

export const TECH_RECOUNT_REASON = "Recount";

const MAX_LINES = 200;
const MAX_REASON = 500;

export interface TechCountEntry {
  txn_type: "count";
  location_id: string;
  item_id: string;
  counted_qty: number;
  reason: string;
}

export interface TechTransferEntry {
  txn_type: "transfer_out" | "transfer_in";
  location_id: string;
  item_id: string;
  qty: number;
  reason: string;
}

export type TechVanEntry = TechCountEntry | TechTransferEntry;

export interface TechCountLine {
  itemId: string;
  countedQty: number;
}

export interface TechPullLine {
  itemId: string;
  qty: number;
}

export interface ParsedTechCountBody {
  vehicleId: string | null;
  lines: TechCountLine[];
  reason: string | null;
  problems: string[];
}

export interface ParsedTechPullBody {
  vehicleId: string | null;
  lines: TechPullLine[];
  problems: string[];
}

function bad(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function countedQty(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < 0 || value > 999999999.999) return undefined;
  if (Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-6) return undefined;
  return value;
}

function pullQty(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value <= 0 || value > 999999999.999) return undefined;
  if (Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-6) return undefined;
  return value;
}

function vehicleIdOf(body: Record<string, unknown>): string | null {
  if (typeof body.vehicleId !== "string") return null;
  const trimmed = body.vehicleId.trim();
  return trimmed || null;
}

/**
 * Recount body. Location, transaction type, and cost are ignored: the server
 * posts a count on the caller's own van and nothing else.
 */
export function parseTechCountBody(body: Record<string, unknown>): ParsedTechCountBody {
  const problems: string[] = [];
  const reason = typeof body.reason === "string" ? body.reason : null;
  if (reason && reason.trim().length > MAX_REASON) problems.push("Keep the note under 500 characters.");

  if (!Array.isArray(body.lines)) {
    return { vehicleId: vehicleIdOf(body), lines: [], reason, problems: [...problems, "lines must be a list."] };
  }
  if (body.lines.length === 0) problems.push("Type a quantity on at least one line.");
  if (body.lines.length > MAX_LINES) problems.push("Count fewer lines at a time.");

  const lines: TechCountLine[] = [];
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

  return { vehicleId: vehicleIdOf(body), lines, reason, problems };
}

/**
 * Pick-list body. Shop and van locations are resolved on the server.
 * A client location, reason, or cost is ignored.
 */
export function parseTechPullBody(body: Record<string, unknown>): ParsedTechPullBody {
  const problems: string[] = [];
  if (!Array.isArray(body.lines)) {
    return { vehicleId: vehicleIdOf(body), lines: [], problems: ["lines must be a list."] };
  }
  if (body.lines.length === 0) problems.push("Check at least one line to pull.");
  if (body.lines.length > MAX_LINES) problems.push("Pull fewer lines at a time.");

  const lines: TechPullLine[] = [];
  const seen = new Set<string>();
  for (const entry of body.lines) {
    if (!entry || typeof entry !== "object") {
      problems.push("Each line needs an item and a quantity.");
      continue;
    }
    const record = entry as Record<string, unknown>;
    const itemId = typeof record.itemId === "string" ? record.itemId.trim() : "";
    if (!itemId) {
      problems.push("Each line needs an item.");
      continue;
    }
    if (seen.has(itemId)) {
      problems.push("Each item can only be pulled once.");
      continue;
    }
    seen.add(itemId);
    const qty = pullQty(record.qty);
    if (qty === undefined) {
      problems.push("A pull quantity must be greater than zero, with at most 3 decimals.");
      continue;
    }
    lines.push({ itemId, qty });
  }

  return { vehicleId: vehicleIdOf(body), lines, problems };
}

export function resolveTechCountReason(explicit: string | null | undefined): string {
  const trimmed = (explicit ?? "").trim();
  if (trimmed.length > MAX_REASON) bad("Keep the note under 500 characters.");
  return trimmed || TECH_RECOUNT_REASON;
}

/** Count rows for lines that differ from on-hand. A match posts nothing. */
export function buildTechCountEntries(args: {
  locationId: string;
  reason: string;
  lines: readonly TechCountLine[];
  onHandByItem: ReadonlyMap<string, number>;
}): { entries: TechCountEntry[]; skipped: number } {
  if (!args.locationId) bad("This van has no stock location.");
  const entries: TechCountEntry[] = [];
  let skipped = 0;
  for (const line of args.lines) {
    const onHand = args.onHandByItem.get(line.itemId) ?? 0;
    if (roundQty(line.countedQty - onHand) === 0) {
      skipped += 1;
      continue;
    }
    entries.push({
      txn_type: "count",
      location_id: args.locationId,
      item_id: line.itemId,
      counted_qty: line.countedQty,
      reason: args.reason,
    });
  }
  return { entries, skipped };
}

/**
 * One shop-out / van-in pair per line. The database assigns the transfer
 * group. The shop id must be the van's resolved warehouse, never another van.
 */
export function buildTechRestockEntries(args: {
  shopLocationId: string;
  vanLocationId: string;
  lines: readonly TechPullLine[];
}): TechTransferEntry[] {
  if (!args.shopLocationId || !args.vanLocationId) bad("Shop warehouse for this van could not be resolved.");
  if (args.shopLocationId === args.vanLocationId) bad("A restock moves parts from the shop onto the van.");
  const entries: TechTransferEntry[] = [];
  for (const line of args.lines) {
    entries.push(
      {
        txn_type: "transfer_out",
        location_id: args.shopLocationId,
        item_id: line.itemId,
        qty: line.qty,
        reason: RESTOCK_REASON,
      },
      {
        txn_type: "transfer_in",
        location_id: args.vanLocationId,
        item_id: line.itemId,
        qty: line.qty,
        reason: RESTOCK_REASON,
      },
    );
  }
  return entries;
}

const PRIVILEGED_KEYS = [
  "unit_cost_cents",
  "job_id",
  "transfer_group_id",
  "reverses_transaction_id",
  "created_by",
  "qty_delta",
] as const;

/** True when a payload would smuggle cost, a job, a group, or an adjust. */
export function techEntryLeak(entry: TechVanEntry): string | null {
  const record = entry as unknown as Record<string, unknown>;
  if (record.txn_type !== "count" && record.txn_type !== "transfer_out" && record.txn_type !== "transfer_in") {
    return "technicians can post a count or a shop-to-van transfer only";
  }
  for (const key of PRIVILEGED_KEYS) {
    if (key in record && record[key] != null) return key;
  }
  return null;
}
