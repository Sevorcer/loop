/**
 * Expected arrivals (Inventory Lane 4, PR C)
 *
 * GET  /api/inventory/arrivals?closed=1 — open arrivals (add closed=1 for received / cancelled history)
 * POST /api/inventory/arrivals          — body { itemId, qty, etaDate, locationId?, forJobId?, supplierNote? }
 *
 * Roles (database RLS is the real gate): GET owner, manager, dispatch, office; POST owner, manager, office.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, queryFlag } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { addArrival, listArrivals } from "@/services/expectedArrivals";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "inventory_expected_arrivals", "select");
  if (!guard.ok) return guard.response;
  try {
    const arrivals = await listArrivals(queryFlag(new URL(request.url), "closed"));
    return NextResponse.json({ arrivals });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "inventory_expected_arrivals", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    return NextResponse.json({ arrival: await addArrival(body) }, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
