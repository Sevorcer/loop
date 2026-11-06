/**
 * Catalog item
 *
 * GET   /api/inventory/items/[id] — read (cost attached only for owner/manager/office)
 * PATCH /api/inventory/items/[id] — update fields and/or `cost`
 *
 * Roles: catalog_items select (all internal) / update (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { createForbiddenResponse, requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { parseCostPayload, parseItemPayload } from "@/features/inventory/utils/itemPayload";
import { hasPermission } from "@/services/authorization";
import { getCatalogItem, setItemCost, updateCatalogItem } from "@/services/inventoryCatalog";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "catalog_items", "select");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  try {
    const item = await getCatalogItem(id, {
      canSeeCost: hasPermission(guard.ctx.role, "catalog_item_costs", "select"),
    });
    return NextResponse.json({ item });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "catalog_items", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const item = parseItemPayload(body);
  const cost = parseCostPayload(body);
  const problems = [...item.problems, ...cost.problems];
  if (problems.length > 0) return validationError(problems.join(" "));
  if (cost.value && !hasPermission(guard.ctx.role, "catalog_item_costs", "update")) {
    return createForbiddenResponse("You are not allowed to change item cost.");
  }

  try {
    const updated = await updateCatalogItem(id, item.value);
    if (cost.value) await setItemCost(id, cost.value, guard.ctx.userId);
    return NextResponse.json({ item: updated });
  } catch (error) {
    return mapInventoryError(error);
  }
}
