/**
 * POST /api/jobs/[id]/material-events — record a field event on a job's materials:
 * missing part, wrong part, substitution, unplanned use, "Bought on the way", kit feedback.
 * Body: { eventType, lineId?, itemId?, qty?, note? }. Capture only; nothing else changes.
 *
 * Roles (database RLS is the real gate): owner, manager, dispatch, office; a tech on a job
 * assigned to them.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { recordMaterialEvent } from "@/services/inventoryPulls";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "job_material_events", "insert");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    return NextResponse.json({ event: await recordMaterialEvent(id, body) }, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
