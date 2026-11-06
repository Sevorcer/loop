/**
 * POST /api/inventory/arrivals/[id]/receive — "Mark received".
 * Posts the ledger receive for the full quantity, marks the arrival received, then tops up
 * waiting jobs in date order.
 *
 * Roles: owner, manager, office.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { receiveArrival } from "@/services/expectedArrivals";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "inventory_expected_arrivals", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    return NextResponse.json({ arrival: await receiveArrival(id) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
