/**
 * POST /api/inventory/pars — set minimum and fill-to on one van.
 *
 * Body: { locationId, rows: [{ itemId, minQty, maxQty }] }
 * Blank min and max clear the par. Only dirty rows should be sent.
 * On-hand is never edited. Cost is never read.
 *
 * Roles: inventory_locations update (owner, manager, office). That is the
 * same set that may edit pars (D4). Dispatch can read stock and cannot edit
 * pars. Techs cannot. fn_inventory_set_par checks the role again. This is
 * not a grant to update inventory_stock_levels.
 */

import { NextResponse } from "next/server";

import { parseParBody } from "@/features/inventory/utils/parPayload";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { setVanPars } from "@/services/inventoryPars";

export async function POST(request: Request) {
  const guard = await requirePermission(request, "inventory_locations", "update");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = parseParBody(body);
  if (parsed.problems.length > 0) return validationError(parsed.problems.join(" "));

  try {
    const saved = await setVanPars(parsed.locationId, parsed.rows);
    return NextResponse.json({ saved });
  } catch (error) {
    return mapInventoryError(error);
  }
}
