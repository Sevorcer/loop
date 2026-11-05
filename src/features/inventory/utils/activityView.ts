/** Pure view logic for the Activity (ledger) screen. */

import { TXN_TYPES, type LedgerEntry, type TxnType } from "../types/ledger";

export const TXN_LABELS: Record<TxnType, string> = {
  receive: "Received",
  transfer_out: "Transfer out",
  transfer_in: "Transfer in",
  issue_to_job: "Issued to job",
  return_from_job: "Returned from job",
  adjust: "Adjustment",
  count: "Count",
  buy_for_job: "Bought for job",
  reversal: "Reversal",
};

export function parseTxnType(value: string | null | undefined): TxnType | undefined {
  return TXN_TYPES.includes(value as TxnType) ? (value as TxnType) : undefined;
}

/** Ids of entries that already have a reversal pointing at them. */
export function reversedEntryIds(entries: readonly Pick<LedgerEntry, "reversesTransactionId">[]): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) if (entry.reversesTransactionId) ids.add(entry.reversesTransactionId);
  return ids;
}

/** A reversal cannot be reversed, and an entry is reversed at most once (as far as the loaded page shows). */
export function canReverseEntry(
  entry: Pick<LedgerEntry, "id" | "txnType">,
  reversed: ReadonlySet<string>,
): boolean {
  return entry.txnType !== "reversal" && !reversed.has(entry.id);
}

export function formatQtyDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

const LEDGER_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Short Pacific-time stamp (the company works in Seattle); stable across server and client. */
export function formatLedgerTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : LEDGER_TIME.format(date);
}

export function summarizeEntry(args: { txnType: TxnType; qtyDelta: number; itemName: string; locationName: string }): string {
  return `${TXN_LABELS[args.txnType]} ${formatQtyDelta(args.qtyDelta)} of ${args.itemName} at ${args.locationName}`;
}
