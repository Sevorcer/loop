/**
 * POST /api/inventory/vans/[vehicleId]/count — office count-in and recount.
 *
 * Body: { lines: [{ itemId, countedQty }], reason? }
 * Blank lines are omitted by the client. A quantity that matches on-hand
 * posts nothing. The first count row that changes on-hand turns restock
 * alerts on for the van. Adjustments of any location stay on
 * POST /api/inventory/transactions (kind adjust or count).
 *
 * Roles: inventory_transactions insert (owner, manager, office). Dispatch
 * can read stock and cannot post. Techs do not use this route.
 * Cost is not read and is not written.
 */

import { NextResponse } from "next/server";

import { parseCountBody } from "@/features/inventory/utils/countSheet";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { postOfficeVanCount } from "@/services/inventoryOfficePosts";

export async function POST(request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const guard = await requirePermission(request, "inventory_transactions", "insert");
  if (!guard.ok) return guard.response;
  const { vehicleId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = parseCountBody(body);
  if (parsed.problems.length > 0) return validationError(parsed.problems.join(" "));

  try {
    const result = await postOfficeVanCount(vehicleId, parsed.lines, parsed.reason, guard.ctx.userId);
    return NextResponse.json(result, { status: result.noChange ? 200 : 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
