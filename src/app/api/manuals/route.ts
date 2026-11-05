/**
 * Drive manuals index — #33
 *
 * GET /api/manuals — the indexed Google Drive manuals (metadata + links),
 *   plus whether Drive is connected and the last sync run.
 *
 * Roles: owner, manager, dispatch, office, sales, tech (read). portal denied.
 * Office-type roles also get config details and the last sync run.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { canReadManuals } from "@/features/manuals/utils/manualRoles";
import { forbiddenResponse, manualErrorResponse } from "@/lib/manuals/routeHelpers";
import { getDriveManualsSnapshot } from "@/services/driveManuals";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "knowledge_items", "select");
  if (!guard.ok) return guard.response;
  if (!canReadManuals(guard.ctx.role)) return forbiddenResponse("You cannot view manuals.");

  try {
    const snapshot = await getDriveManualsSnapshot(guard.ctx.role);
    return NextResponse.json(snapshot);
  } catch (error) {
    return manualErrorResponse(error);
  }
}
