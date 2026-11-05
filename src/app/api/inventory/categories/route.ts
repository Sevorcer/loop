/**
 * Catalog categories (hierarchical, max 3 levels)
 *
 * GET  /api/inventory/categories — list (includeInactive=1 for management)
 * POST /api/inventory/categories — create { name, parentId?, sortOrder? }
 *
 * Roles: catalog_categories select (all internal) / insert (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, queryFlag, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { createCategory, listCategories } from "@/services/inventoryCatalog";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "catalog_categories", "select");
  if (!guard.ok) return guard.response;

  try {
    const categories = await listCategories(queryFlag(new URL(request.url), "includeInactive"));
    return NextResponse.json({ categories });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "catalog_categories", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }
  if (typeof body.name !== "string") return validationError("name is required.");

  try {
    const category = await createCategory({
      name: body.name,
      parentId: typeof body.parentId === "string" ? body.parentId : null,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
