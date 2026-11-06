/**
 * POST /api/inventory/my-van/count — tech recount of their own van.
 *
 * Body: { vehicleId?, lines: [{ itemId, countedQty }], reason? }
 * A blank line is omitted by the client. A quantity that matches on-hand
 * posts nothing. The van must already have an office count-in.
 *
 * This route does not call requirePermission for inventory_transactions
 * insert. Technicians must not gain that grant. The session is checked,
 * the role must be tech, and fn_inventory_post_van_entries checks again.
 * Cost is not read and is not written. Adjust is not accepted.
 */

import { NextResponse } from "next/server";

import { parseTechCountBody } from "@/features/inventory/utils/vanEntries";
import { createForbiddenResponse, resolveRequestRole } from "@/lib/api-auth";
import { requireApiSession } from "@/lib/auth/apiGuard";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { postTechVanCount } from "@/services/inventoryTechPosts";

export async function POST(request: Request) {
  const session = await requireApiSession(request);
  if (session.error) return session.error;
  const role = await resolveRequestRole(request);
  if (role !== "tech") {
    return createForbiddenResponse("Only a technician can post from My van.");
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = parseTechCountBody(body);
  if (parsed.problems.length > 0) return validationError(parsed.problems.join(" "));

  try {
    const result = await postTechVanCount(session.user.id, parsed.vehicleId, parsed.lines, parsed.reason);
    return NextResponse.json(result, { status: result.noChange ? 200 : 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
