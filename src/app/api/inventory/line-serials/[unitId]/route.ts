/**
 * DELETE /api/inventory/line-serials/[unitId] — release a unit from the line it was picked for.
 * A unit is picked for one line at a time, so the unit id names the pick.
 *
 * Roles: job_material_line_serials delete (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { isUuid } from "@/features/inventory/utils/kitRules";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { releaseUnit } from "@/services/inventoryLineSerials";

export async function DELETE(request: Request, { params }: { params: Promise<{ unitId: string }> }) {
  const guard = await requirePermission(request, "job_material_line_serials", "delete");
  if (!guard.ok) return guard.response;
  const { unitId } = await params;
  if (!isUuid(unitId)) return validationError("Pick a unit from the list.");

  try {
    await releaseUnit(unitId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapInventoryError(error);
  }
}
