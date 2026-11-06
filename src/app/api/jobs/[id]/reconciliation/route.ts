/**
 * Closeout reconciliation (Inventory Lane 4, PR E)
 *
 * GET  /api/jobs/[id]/reconciliation — the job's catalog-linked lines with planned / pulled,
 *      the current status (none | submitted | overridden) and the closeout stage.
 * POST /api/jobs/[id]/reconciliation — { lines: [{ lineId, used, returned, recovered?, reason? }] }
 *      Posts used, returned and any explained difference to the ledger in one transaction.
 *
 * Roles: GET job_material_reconciliations select (owner, manager, dispatch, tech, office);
 * POST insert (owner, manager, tech, office). The database function re-checks the role and,
 * for a technician, that the job is assigned to them.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { getReconciliationView, submitReconciliation } from "@/services/closeoutReconciliation";
import { getJobCloseoutMode } from "@/services/jobs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "job_material_reconciliations", "select");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  try {
    return NextResponse.json(await getReconciliationView(id, await getJobCloseoutMode(id)));
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "job_material_reconciliations", "insert");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    return NextResponse.json(await submitReconciliation(id, body, { actorId: guard.ctx.userId }));
  } catch (error) {
    return mapInventoryError(error);
  }
}
