/**
 * PATCH /api/inventory/categories/[id] — rename, move, reorder, (de)activate
 *
 * Roles: catalog_categories update (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { updateCategory } from "@/services/inventoryCatalog";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "catalog_categories", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const patch: { name?: string; parentId?: string | null; sortOrder?: number; isActive?: boolean } = {};
  if ("name" in body) {
    if (typeof body.name !== "string") return validationError("name must be text.");
    patch.name = body.name;
  }
  if ("parentId" in body) {
    if (body.parentId !== null && typeof body.parentId !== "string") return validationError("parentId must be an id or null.");
    patch.parentId = body.parentId as string | null;
  }
  if ("sortOrder" in body) {
    if (typeof body.sortOrder !== "number") return validationError("sortOrder must be a number.");
    patch.sortOrder = body.sortOrder;
  }
  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") return validationError("isActive must be true or false.");
    patch.isActive = body.isActive;
  }

  try {
    return NextResponse.json({ category: await updateCategory(id, patch) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
