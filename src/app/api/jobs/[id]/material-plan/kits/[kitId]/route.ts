/**
 * Refresh a job from its attached kit (Inventory Lane 4, PR B)
 *
 * POST /api/jobs/[id]/material-plan/kits/[kitId] — adds lines the kit gained, updates lines
 * nobody adjusted, and never overwrites a line someone changed.
 * Roles: owner, manager, dispatch, office, sales.
 */

import { NextResponse } from "next/server";

import { canEditMaterialPlan } from "@/features/job-materials/utils/materialPlan";
import { forbiddenResponse } from "@/features/job-materials/utils/routeHelpers";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { getMaterialPlanView, refreshJobKit } from "@/services/materialPlans";

type Params = { params: Promise<{ id: string; kitId: string }> };

export async function POST(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "job_kits", "update");
  if (!guard.ok) return guard.response;
  if (!canEditMaterialPlan(guard.ctx.role)) return forbiddenResponse("Only office staff can refresh a kit.");
  const { id, kitId } = await params;

  try {
    const result = await refreshJobKit(id, kitId, guard.ctx.userId);
    return NextResponse.json({ result, ...(await getMaterialPlanView(id)) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
