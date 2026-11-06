/**
 * PATCH /api/inventory/arrivals/[id] — edit an open arrival or cancel it.
 * Body: { qty?, etaDate?, forJobId?, supplierNote?, cancel?: true }. Received arrivals are frozen.
 *
 * Roles: owner, manager, office.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { changeArrival } from "@/services/expectedArrivals";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "inventory_expected_arrivals", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    return NextResponse.json({ arrival: await changeArrival(id, body) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
