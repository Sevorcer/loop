/**
 * One plan line (Inventory Lane 4, PR B)
 *
 * PATCH /api/jobs/[id]/material-plan/lines/[lineId] — body { action, ... }
 *   action "adjust"   : { quantity?, name?, unit?, notes?, isOptional?, reason }  (reason required for quantity/name/unit)
 *   action "link"     : { catalogItemId, writeAlias? }   resolve a needs-SKU line (owner, manager, office)
 *   action "not_stock": { reason }                       the line is not a stocked item
 *   action "remove"   : { reason }                       take the line off the plan
 *
 * Every change writes a history event in the database. Roles: owner, manager, dispatch,
 * office, sales (link / not_stock: owner, manager, office). Techs keep using the existing
 * /materials/[lineId] route for state and quantity taps.
 */

import { NextResponse } from "next/server";

import { canEditMaterialPlan, canResolveNeedsSku } from "@/features/job-materials/utils/materialPlan";
import { forbiddenResponse, readMaterialBody } from "@/features/job-materials/utils/routeHelpers";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import {
  adjustPlanLine,
  getMaterialPlanView,
  linkPlanLineToItem,
  markPlanLineNotStock,
  removePlanLine,
} from "@/services/materialPlans";

type Params = { params: Promise<{ id: string; lineId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "job_material_plans", "insert");
  if (!guard.ok) return guard.response;
  if (!canEditMaterialPlan(guard.ctx.role)) return forbiddenResponse("Only office staff can change the material plan.");
  const { id, lineId } = await params;

  const read = await readMaterialBody(request);
  if (!read.ok) return read.response;
  const { action } = read.body;

  try {
    switch (action) {
      case "adjust":
        await adjustPlanLine(id, lineId, read.body, guard.ctx.userId);
        break;
      case "remove":
        await removePlanLine(id, lineId, read.body.reason, guard.ctx.userId);
        break;
      case "link":
      case "not_stock": {
        if (!canResolveNeedsSku(guard.ctx.role)) {
          return forbiddenResponse("Only owner, manager or office can resolve a needs-SKU line.");
        }
        if (action === "link") {
          const { writeAlias } = read.body;
          if (writeAlias !== undefined && typeof writeAlias !== "boolean") {
            return validationError("writeAlias must be true or false.");
          }
          await linkPlanLineToItem(id, lineId, read.body.catalogItemId, writeAlias !== false);
        } else {
          await markPlanLineNotStock(id, lineId, read.body.reason);
        }
        break;
      }
      default:
        return validationError('action must be "adjust", "link", "not_stock" or "remove".');
    }
    return NextResponse.json(await getMaterialPlanView(id));
  } catch (error) {
    return mapInventoryError(error);
  }
}
