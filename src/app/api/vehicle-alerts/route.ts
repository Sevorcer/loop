/**
 * Vehicle Alerts API
 *
 * GET  /api/vehicle-alerts — list alerts for the caller's org
 * POST /api/vehicle-alerts — create an alert (reported_by from session)
 *
 * Roles (via requirePermission → authorization.vehicle_alerts):
 *   select/insert: owner, manager, dispatch, office, sales, tech
 *   portal: denied
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
  createApiErrorResponse,
} from "@/lib/api/routeErrors";
import {
  createVehicleAlert,
  isVehicleAlertPriority,
  listVehicleAlerts,
} from "@/services/vehicleAlerts";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "vehicle_alerts", "select");
  if (!guard.ok) return guard.response;

  try {
    const alerts = await listVehicleAlerts({ userId: guard.ctx.userId });
    return NextResponse.json({ alerts });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "vehicle_alerts", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  if (!isVehicleAlertPriority(body.priority)) {
    return createApiErrorResponse(
      "VALIDATION_ERROR",
      "priority must be Low, Medium, or High.",
      400,
    );
  }

  try {
    const alert = await createVehicleAlert(
      {
        vehicleId: typeof body.vehicleId === "string" && body.vehicleId ? body.vehicleId : null,
        vehicleName: String(body.vehicleName ?? ""),
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        priority: body.priority,
        // reported_by always comes from the session — never from the body
        reportedByUserId: guard.ctx.userId,
      },
      { userId: guard.ctx.userId },
    );
    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
