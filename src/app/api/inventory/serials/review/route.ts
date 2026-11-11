/**
 * GET /api/inventory/serials/review — what the office must review
 * (flagged duplicate serials and systems with no usable serial)
 *
 * Roles: inventory_serial_units update (owner, manager, office). Review is an
 * office task, so it uses the write gate rather than the read gate.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { listSerialReview } from "@/services/inventorySerialUnits";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "inventory_serial_units", "update");
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ rows: await listSerialReview() });
  } catch (error) {
    return mapInventoryError(error);
  }
}
