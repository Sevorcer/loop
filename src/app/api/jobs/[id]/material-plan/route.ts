/**
 * Job material plan (Inventory Lane 4, PR B)
 *
 * GET   /api/jobs/[id]/material-plan — plan header, lines, attached kits, needs-SKU count
 * POST  /api/jobs/[id]/material-plan — generate; body { includeEstimate?: boolean, kits?: [{ kitId, multiplier? }] }
 * PATCH /api/jobs/[id]/material-plan — body { status: "confirmed" | "draft" } (confirm / reopen)
 *
 * Roles (database RLS is the real gate):
 *   GET   : every internal role (tech: assigned jobs only)
 *   POST  : owner, manager, dispatch, office, sales
 *   PATCH : owner, manager, dispatch, office
 */

import { NextResponse } from "next/server";

import { canConfirmMaterialPlan, canEditMaterialPlan, parseKitRequests } from "@/features/job-materials/utils/materialPlan";
import { forbiddenResponse, readMaterialBody } from "@/features/job-materials/utils/routeHelpers";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import {
  confirmMaterialPlan,
  generateMaterialPlan,
  getMaterialPlanView,
  reopenMaterialPlan,
} from "@/services/materialPlans";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "job_material_plans", "select");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    return NextResponse.json(await getMaterialPlanView(id));
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "job_material_plans", "insert");
  if (!guard.ok) return guard.response;
  if (!canEditMaterialPlan(guard.ctx.role)) return forbiddenResponse("Only office staff can build a material plan.");
  const { id } = await params;

  const read = await readMaterialBody(request);
  if (!read.ok) return read.response;
  const { includeEstimate } = read.body;
  if (includeEstimate !== undefined && typeof includeEstimate !== "boolean") {
    return validationError("includeEstimate must be true or false.");
  }

  try {
    const summary = await generateMaterialPlan(
      id,
      { includeEstimate: includeEstimate as boolean | undefined, kits: parseKitRequests(read.body.kits) },
      guard.ctx.userId,
    );
    return NextResponse.json({ summary, ...(await getMaterialPlanView(id)) }, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "job_material_plans", "update");
  if (!guard.ok) return guard.response;
  if (!canConfirmMaterialPlan(guard.ctx.role)) return forbiddenResponse("Only office staff can confirm a material plan.");
  const { id } = await params;

  const read = await readMaterialBody(request);
  if (!read.ok) return read.response;
  const { status } = read.body;
  if (status !== "confirmed" && status !== "draft") return validationError('status must be "confirmed" or "draft".');

  try {
    if (status === "confirmed") await confirmMaterialPlan(id, guard.ctx.userId);
    else await reopenMaterialPlan(id, guard.ctx.userId);
    return NextResponse.json(await getMaterialPlanView(id));
  } catch (error) {
    return mapInventoryError(error);
  }
}
