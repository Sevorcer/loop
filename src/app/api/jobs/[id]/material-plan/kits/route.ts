/**
 * Attach a kit to a job (Inventory Lane 4, PR B)
 *
 * POST /api/jobs/[id]/material-plan/kits — body { kitId, multiplier? }
 *
 * The kit's lines are copied onto the job as a snapshot (× multiplier). Later kit edits
 * never change the job; use "Refresh from kit" to pull them in. Roles: owner, manager,
 * dispatch, office, sales.
 */

import { NextResponse } from "next/server";

import { canEditMaterialPlan, parseKitRequests } from "@/features/job-materials/utils/materialPlan";
import { forbiddenResponse, readMaterialBody } from "@/features/job-materials/utils/routeHelpers";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { attachKitToJob, getMaterialPlanView } from "@/services/materialPlans";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "job_kits", "insert");
  if (!guard.ok) return guard.response;
  if (!canEditMaterialPlan(guard.ctx.role)) return forbiddenResponse("Only office staff can attach a kit.");
  const { id } = await params;

  const read = await readMaterialBody(request);
  if (!read.ok) return read.response;

  try {
    const [kit] = parseKitRequests([{ kitId: read.body.kitId, multiplier: read.body.multiplier }]);
    const summary = await attachKitToJob(id, kit, guard.ctx.userId);
    return NextResponse.json({ summary, ...(await getMaterialPlanView(id)) }, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
