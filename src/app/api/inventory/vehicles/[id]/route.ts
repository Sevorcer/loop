/**
 * PATCH /api/inventory/vehicles/[id] — edit a vehicle (name, plate, status, crew, notes)
 *
 * Roles: vehicles update (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { parseVehiclePayload } from "@/features/inventory/utils/vehiclePayload";
import { updateVehicle } from "@/services/inventoryLocations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "vehicles", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = parseVehiclePayload(body);
  if (parsed.problems.length > 0) return validationError(parsed.problems.join(" "));

  try {
    return NextResponse.json({ vehicle: await updateVehicle(id, parsed.value) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
