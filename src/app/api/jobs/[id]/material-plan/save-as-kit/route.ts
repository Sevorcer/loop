/**
 * Save this job's materials as a kit (Inventory Lane 4, PR B)
 *
 * POST /api/jobs/[id]/material-plan/save-as-kit — body { name }
 * Only lines linked to catalog items go into the kit; the response says how many were left out.
 * Roles: kit_templates insert (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { readMaterialBody } from "@/features/job-materials/utils/routeHelpers";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { saveJobMaterialsAsKit } from "@/services/materialPlans";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "kit_templates", "insert");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const read = await readMaterialBody(request);
  if (!read.ok) return read.response;

  try {
    const result = await saveJobMaterialsAsKit(id, read.body.name);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
