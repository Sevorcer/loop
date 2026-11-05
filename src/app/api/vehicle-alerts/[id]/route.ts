/**
 * Vehicle Alerts — status update
 *
 * PATCH /api/vehicle-alerts/[id] — change status
 *
 * Roles: owner, manager, office, dispatch (update). portal/tech/sales denied.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  createApiErrorResponse,
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import {
  isVehicleAlertStatus,
  updateVehicleAlertStatus,
} from "@/services/vehicleAlerts";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "vehicle_alerts", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  if (!isVehicleAlertStatus(body.status)) {
    return createApiErrorResponse(
      "VALIDATION_ERROR",
      "status must be New, Acknowledged, Scheduled, or Resolved.",
      400,
    );
  }

  try {
    const alert = await updateVehicleAlertStatus(id, body.status, {
      userId: guard.ctx.userId,
    });
    return NextResponse.json({ alert });
  } catch (error) {
    return mapRouteError(error);
  }
}
