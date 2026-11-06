/**
 * POST /api/inventory/my-van/restock — tech pick from the shop onto their van.
 *
 * Body: { vehicleId?, lines: [{ itemId, qty }] }
 * Each checked line is one shop-to-own-van transfer, reason Restock.
 * Client locations, reasons, and costs are ignored. The line must be below
 * par on the caller's van. A short shop does not block the post.
 *
 * This route does not call requirePermission for inventory_transactions
 * insert. The session is checked, the role must be tech, and
 * fn_inventory_post_van_entries checks again. Cost is not read.
 */

import { NextResponse } from "next/server";

import { parseTechPullBody } from "@/features/inventory/utils/vanEntries";
import { createForbiddenResponse, resolveRequestRole } from "@/lib/api-auth";
import { requireApiSession } from "@/lib/auth/apiGuard";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { postTechVanRestock } from "@/services/inventoryTechPosts";

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

  const parsed = parseTechPullBody(body);
  if (parsed.problems.length > 0) return validationError(parsed.problems.join(" "));

  try {
    const result = await postTechVanRestock(session.user.id, parsed.vehicleId, parsed.lines);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
