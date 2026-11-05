/**
 * One indexed Drive manual — #33
 *
 * PATCH /api/manuals/[id] — correct the manufacturer / model Loop parsed from
 *   the file name. Body: { manufacturer?: string|null, model?: string|null }.
 *   Overrides survive re-syncs. Drive itself is never changed.
 *
 * Roles: owner, manager, dispatch, office.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { canManageManuals } from "@/features/manuals/utils/manualRoles";
import {
  forbiddenResponse,
  invalidIdResponse,
  isUuid,
  manualErrorResponse,
  readManualBody,
} from "@/lib/manuals/routeHelpers";
import { updateDriveManual } from "@/services/driveManuals";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "knowledge_items", "select");
  if (!guard.ok) return guard.response;
  if (!canManageManuals(guard.ctx.role)) return forbiddenResponse("Only office staff can edit manuals.");

  const { id } = await params;
  if (!isUuid(id)) return invalidIdResponse("Manual id");

  const parsed = await readManualBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const manual = await updateDriveManual(id, parsed.body);
    emitAuditEvent({ role: guard.ctx.role, action: "update", resource: "drive_manual_files", resourceId: id });
    return NextResponse.json({ manual });
  } catch (error) {
    return manualErrorResponse(error);
  }
}
