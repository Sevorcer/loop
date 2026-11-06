/**
 * POST /api/inventory/restock — office pull from the shop onto a van.
 *
 * Body: { lines: [{ itemId, fromLocationId, toLocationId, qty }] }
 * Each line is one transfer pair with reason Restock and its own transfer
 * group. Unchecked lines are omitted. There is no approval queue and no
 * second received step. A short shop does not block the post.
 *
 * Roles: inventory_transactions insert (owner, manager, office). The Needs
 * restock page is readable by anyone who can read stock, including dispatch.
 * Techs do not use this route. Cost is not read and is not written.
 */

import { NextResponse } from "next/server";

import { parseRestockBody } from "@/features/inventory/utils/restockPost";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { postOfficeRestock } from "@/services/inventoryOfficePosts";

export async function POST(request: Request) {
  const guard = await requirePermission(request, "inventory_transactions", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = parseRestockBody(body);
  if (parsed.problems.length > 0) return validationError(parsed.problems.join(" "));

  try {
    const result = await postOfficeRestock(parsed.lines, guard.ctx.userId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
