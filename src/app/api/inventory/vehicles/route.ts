/**
 * Vehicles
 *
 * GET  /api/inventory/vehicles — list (includeRetired=1 to include retired)
 * POST /api/inventory/vehicles — create { name, plate?, vin?, status?, crewId?, notes?, operators? };
 *                                also creates the vehicle's van stock location.
 *                                Vehicles are added by hand; nothing is auto-created.
 *                                operators assigns vehicle_operators and does not replace crews.vehicle_id.
 *
 * Roles: vehicles select (all internal: techs/sales file vehicle alerts) / insert (owner, manager, office).
 * Operator writes also require vehicle_operators insert.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, queryFlag, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { parseVehiclePayload } from "@/features/inventory/utils/vehiclePayload";
import { hasPermission } from "@/services/authorization";
import { createVehicle, listVehicles } from "@/services/inventoryLocations";
import { replaceVehicleOperators } from "@/services/vehicleOperators";

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
    if (parsed.operators && !hasPermission(guard.ctx.role, "vehicle_operators", "insert")) {
      throw Object.assign(new Error("You do not have permission to assign people to a van."), { status: 403 });
    }
    const result = await createVehicle({ ...parsed.value, name: parsed.value.name });
    if (parsed.operators && parsed.operators.length > 0) {
      try {
        await replaceVehicleOperators(result.vehicle.id, parsed.operators, {
          canDelete: hasPermission(guard.ctx.role, "vehicle_operators", "delete"),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "People could not be assigned.";
        const status = (error as { status?: number }).status ?? 400;
        throw Object.assign(new Error(`"${parsed.value.name}" was added, but people could not be assigned. ${message}`), { status });
      }
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
