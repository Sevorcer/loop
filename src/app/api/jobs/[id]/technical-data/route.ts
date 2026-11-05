/**
 * Job technical data — #23
 *
 * GET /api/jobs/[id]/technical-data — specs for the job's equipment, built
 * from installed_systems + technical_profiles + Company Brain matches.
 *
 * Roles: owner, manager, dispatch, office, sales, tech (tech: assigned jobs —
 * the job read is RLS-scoped, so an unassigned job is a 404). portal denied.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse } from "@/lib/api/routeErrors";
import { canViewJobMaterials, isUuid } from "@/features/job-materials/utils/jobMaterials";
import {
  forbiddenResponse,
  invalidIdResponse,
  materialErrorResponse,
} from "@/features/job-materials/utils/routeHelpers";
import { getJobTechnicalData } from "@/services/jobMaterials";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;
  if (!canViewJobMaterials(guard.ctx.role)) {
    return forbiddenResponse("You cannot view technical data.");
  }

  const { id } = await params;
  if (!isUuid(id)) return invalidIdResponse("Job id");

  try {
    const technicalData = await getJobTechnicalData(id);
    if (!technicalData) {
      return createApiErrorResponse("NOT_FOUND", "Job not found.", 404);
    }
    return NextResponse.json({ technicalData });
  } catch (error) {
    return materialErrorResponse(error);
  }
}
