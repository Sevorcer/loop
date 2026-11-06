/**
 * POST /api/jobs/[id]/reconciliation/override — { reason }
 * Soft stage only: an office role completes a job without reconciling its materials and says
 * why. The database function refuses every other role; the service refuses any other stage.
 *
 * Roles: job_material_reconciliations insert, narrowed to owner / manager / office here.
 */

import { NextResponse } from "next/server";

import { canOverrideMaterials } from "@/features/inventory/utils/reconciliation";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { overrideReconciliation } from "@/services/closeoutReconciliation";
import { getSettings } from "@/services/inventorySettings";

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
    const { closeoutEnforcement } = await getSettings();
    if (!canOverrideMaterials(closeoutEnforcement, guard.ctx.role)) {
      return validationError(
        closeoutEnforcement === "soft"
          ? "Only the office can override material reconciliation."
          : "Material reconciliation can only be overridden at the office-override stage.",
      );
    }
    await overrideReconciliation(id, body.reason, { actorId: guard.ctx.userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapInventoryError(error);
  }
}
