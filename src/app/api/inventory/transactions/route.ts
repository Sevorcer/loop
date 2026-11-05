/**
 * Inventory ledger (append-only)
 *
 * GET  /api/inventory/transactions — history (itemId, locationId, jobId, txnType, limit)
 * POST /api/inventory/transactions — post a command:
 *        receive | adjust | count | transfer | issue_to_job | return_from_job | reverse
 *      Corrections are opposite entries (`reverse`), never edits. Nothing blocks on stock
 *      level: on-hand may go negative and the UI warns instead.
 *
 * Roles: inventory_transactions select (owner, manager, dispatch, office) / insert (owner, manager, office).
 * created_by always comes from the session, never the body.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, queryInt, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { TXN_TYPES, type LedgerFilters, type TxnType } from "@/features/inventory/types/ledger";
import { parseLedgerCommand } from "@/features/inventory/utils/ledgerPayload";
import { listLedger, postLedgerCommand } from "@/services/inventoryLedger";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "inventory_transactions", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const txnType = url.searchParams.get("txnType");
  const filters: LedgerFilters = {
    itemId: url.searchParams.get("itemId") ?? undefined,
    locationId: url.searchParams.get("locationId") ?? undefined,
    jobId: url.searchParams.get("jobId") ?? undefined,
    txnType: txnType && TXN_TYPES.includes(txnType as TxnType) ? (txnType as TxnType) : undefined,
    limit: queryInt(url, "limit"),
  };

  try {
    return NextResponse.json({ entries: await listLedger(filters) });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "inventory_transactions", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = parseLedgerCommand(body);
  if (!parsed.command) return validationError(parsed.problem ?? "Invalid ledger command.");

  try {
    const result = await postLedgerCommand(parsed.command, guard.ctx.userId);
    return NextResponse.json(result, { status: result.noChange ? 200 : 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
