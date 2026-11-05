/**
 * Vehicles
 *
 * GET  /api/inventory/vehicles — list (includeRetired=1 to include retired)
 * POST /api/inventory/vehicles — create { name, plate?, vin?, status?, crewId?, notes? };
 *                                also creates the vehicle's van stock location.
 *                                Vehicles are added by hand; nothing is auto-created.
 *
 * Roles: vehicles select (all internal: techs/sales file vehicle alerts) / insert (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, queryFlag, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { parseVehiclePayload } from "@/features/inventory/utils/vehiclePayload";
import { createVehicle, listVehicles } from "@/services/inventoryLocations";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "vehicles", "select");
  if (!guard.ok) return guard.response;

  try {
    const vehicles = await listVehicles(queryFlag(new URL(request.url), "includeRetired"));
    return NextResponse.json({ vehicles });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "vehicles", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = parseVehiclePayload(body);
  if (parsed.problems.length > 0) return validationError(parsed.problems.join(" "));
  if (typeof parsed.value.name !== "string") return validationError("name is required.");

  try {
    const result = await createVehicle({ ...parsed.value, name: parsed.value.name });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
