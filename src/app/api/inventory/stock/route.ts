/**
 * GET /api/inventory/stock — on-hand per item and location (a cache of the ledger)
 *
 * Query: locationId, itemId (both optional).
 * Roles: inventory_stock_levels select (owner, manager, dispatch, office). Read-only for everyone:
 * quantities change only by posting ledger entries.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { listStockLevels } from "@/services/inventoryLedger";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "inventory_stock_levels", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  try {
    const stock = await listStockLevels({
      locationId: url.searchParams.get("locationId") ?? undefined,
      itemId: url.searchParams.get("itemId") ?? undefined,
    });
    return NextResponse.json({ stock });
  } catch (error) {
    return mapInventoryError(error);
  }
}
