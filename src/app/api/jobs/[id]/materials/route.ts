/**
 * Job materials — #23
 *
 * GET  /api/jobs/[id]/materials — the job's materials list
 * POST /api/jobs/[id]/materials — add a line
 *
 * Roles:
 *   GET : owner, manager, dispatch, office, sales, tech (tech: assigned jobs — RLS)
 *   POST: owner, manager, dispatch, office, sales
 *   portal: denied everywhere (requirePermission jobs/select excludes portal)
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  canManageJobMaterials,
  canViewJobMaterials,
  isUuid,
  parseJobMaterialCreate,
} from "@/features/job-materials/utils/jobMaterials";
import {
  forbiddenResponse,
  invalidIdResponse,
  materialErrorResponse,
  readMaterialBody,
} from "@/features/job-materials/utils/routeHelpers";
import { addJobMaterial, getJobMaterials } from "@/services/jobMaterials";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;
  if (!canViewJobMaterials(guard.ctx.role)) {
    return forbiddenResponse("You cannot view job materials.");
  }

  const { id } = await params;
  if (!isUuid(id)) return invalidIdResponse("Job id");

  try {
    const materials = await getJobMaterials(id);
    return NextResponse.json({ materials });
  } catch (error) {
    return materialErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;
  if (!canManageJobMaterials(guard.ctx.role)) {
    return forbiddenResponse("Only office staff can add materials.");
  }

  const { id } = await params;
  if (!isUuid(id)) return invalidIdResponse("Job id");

  const read = await readMaterialBody(request);
  if (!read.ok) return read.response;

  try {
    const input = parseJobMaterialCreate(read.body);
    const material = await addJobMaterial(id, input);
    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    return materialErrorResponse(error);
  }
}
