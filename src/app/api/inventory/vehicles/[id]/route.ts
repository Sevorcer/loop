/**
 * PATCH /api/inventory/vehicles/[id] — edit a vehicle (name, plate, status, crew, notes)
 *
 * Also accepts:
 * - operators: { userId, isHome }[] — who opens this van on the phone (vehicle_operators).
 *   Does not replace crews.vehicle_id. Removing someone is owner-only.
 * - ensureLocation: true — create the van's stock location when it is missing.
 *
 * Roles: vehicles update (owner, manager, office). Operator writes also require
 * vehicle_operators insert. Cost is never read.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { parseVehiclePayload } from "@/features/inventory/utils/vehiclePayload";
import { ensureVanLocation, getVehicleOrThrow, updateVehicle } from "@/services/inventoryLocations";
import { replaceVehicleOperators } from "@/services/vehicleOperators";
import { hasPermission } from "@/services/authorization";

const VEHICLE_KEYS = ["name", "plate", "vin", "status", "crewId", "notes"] as const;

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

  const touchesVehicle = VEHICLE_KEYS.some((key) => key in parsed.value);

  try {
    if (parsed.operators && !hasPermission(guard.ctx.role, "vehicle_operators", "insert")) {
      throw Object.assign(new Error("You do not have permission to assign people to a van."), { status: 403 });
    }

    const vehicle = touchesVehicle ? await updateVehicle(id, parsed.value) : await getVehicleOrThrow(id);
    if (parsed.ensureLocation) await ensureVanLocation(vehicle);
    if (parsed.operators) {
      try {
        await replaceVehicleOperators(id, parsed.operators, {
          canDelete: hasPermission(guard.ctx.role, "vehicle_operators", "delete"),
        });
      } catch (error) {
        if (!touchesVehicle) throw error;
        const message = error instanceof Error ? error.message : "People could not be assigned.";
        const status = (error as { status?: number }).status ?? 400;
        throw Object.assign(new Error(`The van was saved, but people could not be assigned. ${message}`), { status });
      }
    }
    return NextResponse.json({ vehicle: touchesVehicle ? vehicle : await getVehicleOrThrow(id) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
