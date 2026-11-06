/**
 * GET /api/inventory/pulls — the pull queue: confirmed jobs with stock reserved or on the
 * pallet (soonest first) and the pallets stranded on cancelled / deleted jobs.
 *
 * Roles (database RLS is the real gate): owner, manager, dispatch, office.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { getPullQueue } from "@/services/inventoryPulls";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "inventory_reservations", "select");
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json(await getPullQueue());
  } catch (error) {
    return mapInventoryError(error);
  }
}
