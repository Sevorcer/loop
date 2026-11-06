/**
 * Inventory rules (Inventory Lane 4)
 *
 * GET   /api/inventory/settings — readiness lead days, arrival buffer, closeout stage
 *       (built-in defaults when the org has not saved any yet)
 * PATCH /api/inventory/settings — owner only; { readinessLeadDays?, arrivalBufferDays? }
 *
 * Roles: inventory_settings select (owner, manager, dispatch, office) / update (owner).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { getSettings, updateSettings } from "@/services/inventorySettings";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "inventory_settings", "select");
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ settings: await getSettings() });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function PATCH(request: Request) {
  const guard = await requirePermission(request, "inventory_settings", "update");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return validationError("Send a JSON object.");

  try {
    return NextResponse.json({ settings: await updateSettings(body) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
