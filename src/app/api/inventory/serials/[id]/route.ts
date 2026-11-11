/**
 * PATCH /api/inventory/serials/[id] — settle one flagged serial unit
 *
 * Body: { action: "keep" | "correct" | "remove", serialNumber?: string }
 *   keep     the unit really holds this serial (409 while another unit does)
 *   correct  replace the serial on the system with the nameplate value
 *   remove   take the serial off the system
 *
 * Roles: inventory_serial_units update (owner, manager, office). correct and
 * remove also change the system's serial list, so installed_systems update is required.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { resolveSerialReview, reviewCommandChangesSystem } from "@/services/inventorySerialUnits";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "inventory_serial_units", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  if (reviewCommandChangesSystem(body)) {
    const systemGuard = await requirePermission(request, "installed_systems", "update");
    if (!systemGuard.ok) return systemGuard.response;
  }

  try {
    return NextResponse.json({ units: await resolveSerialReview(id, body) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
