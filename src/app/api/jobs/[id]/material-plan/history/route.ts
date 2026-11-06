/**
 * GET /api/jobs/[id]/material-plan/history — the plan's change history, newest first.
 * Roles: every internal role (tech: assigned jobs only — RLS).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { getMaterialPlanHistory } from "@/services/materialPlans";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "job_material_line_events", "select");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    return NextResponse.json({ events: await getMaterialPlanHistory(id) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
