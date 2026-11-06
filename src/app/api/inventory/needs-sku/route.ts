/**
 * GET /api/inventory/needs-sku — plan lines nobody has linked to a catalog item yet.
 * Roles: owner, manager, dispatch, office, sales (catalog_item_aliases select).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { getNeedsSkuQueue } from "@/services/materialPlans";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "catalog_item_aliases", "select");
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json({ lines: await getNeedsSkuQueue() });
  } catch (error) {
    return mapInventoryError(error);
  }
}
