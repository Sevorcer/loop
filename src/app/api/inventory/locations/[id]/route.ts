/**
 * PATCH /api/inventory/locations/[id] — rename, re-parent, set address, (de)activate
 *
 * Roles: inventory_locations update (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { updateLocation } from "@/services/inventoryLocations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "inventory_locations", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const patch: { name?: string; parentLocationId?: string | null; address?: string | null; isActive?: boolean } = {};
  if ("name" in body) {
    if (typeof body.name !== "string") return validationError("name must be text.");
    patch.name = body.name;
  }
  if ("parentLocationId" in body) {
    if (body.parentLocationId !== null && typeof body.parentLocationId !== "string") {
      return validationError("parentLocationId must be an id or null.");
    }
    patch.parentLocationId = body.parentLocationId as string | null;
  }
  if ("address" in body) {
    if (body.address !== null && typeof body.address !== "string") return validationError("address must be text or null.");
    patch.address = body.address as string | null;
  }
  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") return validationError("isActive must be true or false.");
    patch.isActive = body.isActive;
  }

  try {
    return NextResponse.json({ location: await updateLocation(id, patch) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
