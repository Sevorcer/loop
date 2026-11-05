/** Pure request-body parsing for ledger commands (POST /api/inventory/transactions). */

import type { LedgerCommand } from "../types/ledger";

type Body = Record<string, unknown>;

function str(body: Body, key: string): string | undefined {
  return typeof body[key] === "string" && (body[key] as string).trim() ? (body[key] as string) : undefined;
}

function num(body: Body, key: string): number | undefined {
  return typeof body[key] === "number" && Number.isFinite(body[key]) ? (body[key] as number) : undefined;
}

export const LEDGER_COMMAND_KINDS = [
  "receive",
  "adjust",
  "count",
  "transfer",
  "issue_to_job",
  "return_from_job",
  "reverse",
] as const;

export function parseLedgerCommand(body: Body): { command?: LedgerCommand; problem?: string } {
  const kind = body.kind;
  if (typeof kind !== "string" || !LEDGER_COMMAND_KINDS.includes(kind as (typeof LEDGER_COMMAND_KINDS)[number])) {
    return { problem: `kind must be one of: ${LEDGER_COMMAND_KINDS.join(", ")}.` };
  }

  const itemId = str(body, "itemId");
  const locationId = str(body, "locationId");
  const reason = str(body, "reason");

  switch (kind) {
    case "receive": {
      const qty = num(body, "qty");
      if (!itemId || !locationId || qty === undefined) return { problem: "receive needs itemId, locationId and qty." };
      return { command: { kind, itemId, locationId, qty, unitCostCents: num(body, "unitCostCents") ?? null, reason: reason ?? null } };
    }
    case "adjust": {
      const qtyDelta = num(body, "qtyDelta");
      if (!itemId || !locationId || qtyDelta === undefined || !reason) {
        return { problem: "adjust needs itemId, locationId, qtyDelta and a reason." };
      }
      return { command: { kind, itemId, locationId, qtyDelta, reason } };
    }
    case "count": {
      const countedQty = num(body, "countedQty");
      if (!itemId || !locationId || countedQty === undefined) return { problem: "count needs itemId, locationId and countedQty." };
      return { command: { kind, itemId, locationId, countedQty, reason: reason ?? null } };
    }
    case "transfer": {
      const fromLocationId = str(body, "fromLocationId");
      const toLocationId = str(body, "toLocationId");
      const qty = num(body, "qty");
      if (!itemId || !fromLocationId || !toLocationId || qty === undefined) {
        return { problem: "transfer needs itemId, fromLocationId, toLocationId and qty." };
      }
      return { command: { kind, itemId, fromLocationId, toLocationId, qty, reason: reason ?? null } };
    }
    case "issue_to_job":
    case "return_from_job": {
      const jobId = str(body, "jobId");
      const qty = num(body, "qty");
      if (!itemId || !locationId || !jobId || qty === undefined) return { problem: `${kind} needs itemId, locationId, jobId and qty.` };
      return { command: { kind, itemId, locationId, jobId, qty } };
    }
    default: {
      const transactionId = str(body, "transactionId");
      if (!transactionId || !reason) return { problem: "reverse needs transactionId and a reason." };
      return { command: { kind: "reverse", transactionId, reason } };
    }
  }
}
