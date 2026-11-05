/**
 * Pure ledger rules: turn a command into the ledger rows to append.
 *
 * Quantity changes ONLY by appending rows. Nothing here edits history:
 * corrections, cancellations and returns are opposite entries. Nothing
 * hard-blocks on stock level (negative on-hand is allowed in Lane 1; the UI
 * warns instead), so no rule here reads on-hand except `count`, which needs it
 * to compute the delta.
 */

import type { LedgerCommand, LedgerEntry, NewLedgerRow } from "../types/ledger";

export class LedgerRuleError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "LedgerRuleError";
  }
}

/** numeric(12,3): positive, finite, at most 3 decimals. */
export function isValidQty(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return false;
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-9 && value < 1e9;
}

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function requireQty(value: unknown, label = "qty"): number {
  if (!isValidQty(value)) {
    throw new LedgerRuleError(`${label} must be a positive number with at most 3 decimals.`);
  }
  return value;
}

function requireReason(reason: string | null | undefined, what: string): string {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length === 0) throw new LedgerRuleError(`A reason is required for ${what}.`);
  return trimmed;
}

function cleanReason(reason: string | null | undefined): string | null {
  const trimmed = (reason ?? "").trim();
  return trimmed.length === 0 ? null : trimmed;
}

export interface LedgerRuleContext {
  /** Generates the shared id for a transfer pair. */
  newTransferGroupId: () => string;
  /** Current on-hand, required for `count`. */
  currentOnHand?: number;
  /** Original rows, required for `reverse` (the whole transfer group for a transfer). */
  originals?: readonly LedgerEntry[];
}

/** Expands one command into rows to append. `count` with no difference returns []. */
export function expandLedgerCommand(command: LedgerCommand, ctx: LedgerRuleContext): NewLedgerRow[] {
  switch (command.kind) {
    case "receive": {
      const qty = requireQty(command.qty);
      return [
        {
          txnType: "receive",
          itemId: command.itemId,
          locationId: command.locationId,
          qtyDelta: qty,
          unitCostCents: command.unitCostCents ?? null,
          reason: cleanReason(command.reason),
        },
      ];
    }

    case "adjust": {
      if (
        typeof command.qtyDelta !== "number" ||
        !Number.isFinite(command.qtyDelta) ||
        command.qtyDelta === 0 ||
        Math.abs(command.qtyDelta * 1000 - Math.round(command.qtyDelta * 1000)) > 1e-9
      ) {
        throw new LedgerRuleError("qtyDelta must be a non-zero number with at most 3 decimals.");
      }
      return [
        {
          txnType: "adjust",
          itemId: command.itemId,
          locationId: command.locationId,
          qtyDelta: command.qtyDelta,
          reason: requireReason(command.reason, "an adjustment"),
        },
      ];
    }

    case "count": {
      if (
        typeof command.countedQty !== "number" ||
        !Number.isFinite(command.countedQty) ||
        command.countedQty < 0 ||
        Math.abs(command.countedQty * 1000 - Math.round(command.countedQty * 1000)) > 1e-9
      ) {
        throw new LedgerRuleError("countedQty must be 0 or more with at most 3 decimals.");
      }
      if (typeof ctx.currentOnHand !== "number") {
        throw new LedgerRuleError("Current on-hand is required to post a count.");
      }
      const delta = roundQty(command.countedQty - ctx.currentOnHand);
      if (delta === 0) return [];
      return [
        {
          txnType: "count",
          itemId: command.itemId,
          locationId: command.locationId,
          qtyDelta: delta,
          reason: cleanReason(command.reason) ?? "Physical count",
        },
      ];
    }

    case "transfer": {
      const qty = requireQty(command.qty);
      if (command.fromLocationId === command.toLocationId) {
        throw new LedgerRuleError("Transfer needs two different locations.");
      }
      const groupId = ctx.newTransferGroupId();
      const reason = cleanReason(command.reason);
      return [
        { txnType: "transfer_out", itemId: command.itemId, locationId: command.fromLocationId, qtyDelta: -qty, transferGroupId: groupId, reason },
        { txnType: "transfer_in", itemId: command.itemId, locationId: command.toLocationId, qtyDelta: qty, transferGroupId: groupId, reason },
      ];
    }

    case "issue_to_job": {
      const qty = requireQty(command.qty);
      return [{ txnType: "issue_to_job", itemId: command.itemId, locationId: command.locationId, qtyDelta: -qty, jobId: command.jobId }];
    }

    case "return_from_job": {
      const qty = requireQty(command.qty);
      return [{ txnType: "return_from_job", itemId: command.itemId, locationId: command.locationId, qtyDelta: qty, jobId: command.jobId }];
    }

    case "reverse": {
      const reason = requireReason(command.reason, "a reversal");
      const originals = ctx.originals ?? [];
      if (originals.length === 0) throw new LedgerRuleError("The entry to reverse was not found.");
      for (const original of originals) {
        if (original.txnType === "reversal") {
          throw new LedgerRuleError("A reversal cannot itself be reversed; post a new entry instead.");
        }
      }
      return originals.map((original) => ({
        txnType: "reversal" as const,
        itemId: original.itemId,
        locationId: original.locationId,
        qtyDelta: -original.qtyDelta,
        jobId: original.jobId,
        reversesTransactionId: original.id,
        reason,
      }));
    }
  }
}
