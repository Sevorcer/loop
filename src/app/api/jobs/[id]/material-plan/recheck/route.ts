/**
 * POST /api/jobs/[id]/material-plan/recheck — "Re-check": re-derive what the job may hold
 * and refresh readiness for the whole company (jobs compete for the same stock).
 *
 * Roles: owner, manager, dispatch, office.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { getMaterialPlanView } from "@/services/materialPlans";
import { reserveJobMaterials } from "@/services/inventoryReservations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "inventory_reservations", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    const reservation = await reserveJobMaterials(id, "plan_changed");
    return NextResponse.json({ reservation, ...(await getMaterialPlanView(id)) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
