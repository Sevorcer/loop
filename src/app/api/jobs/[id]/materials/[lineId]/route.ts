/**
 * Job materials — one line (#23)
 *
 * PATCH  /api/jobs/[id]/materials/[lineId] — move state / change qty / edit
 * DELETE /api/jobs/[id]/materials/[lineId] — remove the line
 *
 * Roles:
 *   PATCH : owner, manager, dispatch, office, sales — any field
 *           tech — `state` and `quantity` only, assigned jobs only (RLS +
 *           guard_tech_job_material_update trigger back this up)
 *   DELETE: owner, manager, dispatch, office, sales
 *   portal: denied
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  TECH_PATCH_KEYS,
  canManageJobMaterials,
  canUpdateJobMaterialProgress,
  isUuid,
  parseJobMaterialPatch,
} from "@/features/job-materials/utils/jobMaterials";
import {
  forbiddenResponse,
  invalidIdResponse,
  materialErrorResponse,
  readMaterialBody,
} from "@/features/job-materials/utils/routeHelpers";
import { removeJobMaterial, updateJobMaterial } from "@/services/jobMaterials";

type Params = { params: Promise<{ id: string; lineId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;
  if (!canUpdateJobMaterialProgress(guard.ctx.role)) {
    return forbiddenResponse("You cannot update job materials.");
  }

  const { id, lineId } = await params;
  if (!isUuid(id)) return invalidIdResponse("Job id");
  if (!isUuid(lineId)) return invalidIdResponse("Material line id");

  const read = await readMaterialBody(request);
  if (!read.ok) return read.response;

  if (!canManageJobMaterials(guard.ctx.role)) {
    const extra = Object.keys(read.body).filter((key) => !TECH_PATCH_KEYS.has(key));
    if (extra.length > 0) {
      return forbiddenResponse("Technicians can only change a material's state and quantity.");
    }
  }

  try {
    const patch = parseJobMaterialPatch(read.body);
    const material = await updateJobMaterial(id, lineId, patch);
    return NextResponse.json({ material });
  } catch (error) {
    return materialErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;
  if (!canManageJobMaterials(guard.ctx.role)) {
    return forbiddenResponse("Only office staff can remove materials.");
  }

  const { id, lineId } = await params;
  if (!isUuid(id)) return invalidIdResponse("Job id");
  if (!isUuid(lineId)) return invalidIdResponse("Material line id");

  try {
    await removeJobMaterial(id, lineId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return materialErrorResponse(error);
  }
}
