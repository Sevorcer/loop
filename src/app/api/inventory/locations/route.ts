/**
 * Inventory locations (warehouse, van, quarantine/RMA)
 *
 * GET  /api/inventory/locations — list (includeInactive=1 for management)
 * POST /api/inventory/locations — create a warehouse or quarantine location
 *      (van locations are created with their vehicle; job locations by buy-for-job later)
 *
 * Roles: inventory_locations select (owner, manager, dispatch, office) / insert (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, queryFlag, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { createLocation, listLocations } from "@/services/inventoryLocations";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "inventory_locations", "select");
  if (!guard.ok) return guard.response;

  try {
    const locations = await listLocations(queryFlag(new URL(request.url), "includeInactive"));
    return NextResponse.json({ locations });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "inventory_locations", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }
  if (typeof body.name !== "string") return validationError("name is required.");
  if (body.type !== "warehouse" && body.type !== "quarantine") {
    return validationError("type must be warehouse or quarantine.");
  }

  try {
    const location = await createLocation({
      type: body.type,
      name: body.name,
      parentLocationId: typeof body.parentLocationId === "string" ? body.parentLocationId : null,
      address: typeof body.address === "string" ? body.address : null,
    });
    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
