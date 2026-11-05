/**
 * Drive manuals sync — #33
 *
 * POST /api/manuals/sync — re-read the shared Drive folders with the Google
 *   service account and refresh the index (metadata + links only).
 *
 * Roles: owner, manager, dispatch, office. 503 until the
 * GOOGLE_DRIVE_SERVICE_ACCOUNT_* / GOOGLE_DRIVE_MANUAL_FOLDER_IDS env vars
 * are set.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { canManageManuals } from "@/features/manuals/utils/manualRoles";
import { forbiddenResponse, manualErrorResponse } from "@/lib/manuals/routeHelpers";
import { syncDriveManuals } from "@/services/driveManuals";

export async function POST(request: Request) {
  const guard = await requirePermission(request, "knowledge_items", "select");
  if (!guard.ok) return guard.response;
  if (!canManageManuals(guard.ctx.role)) return forbiddenResponse("Only office staff can sync Drive manuals.");

  try {
    const run = await syncDriveManuals();
    emitAuditEvent({ role: guard.ctx.role, action: "update", resource: "drive_manual_files", resourceId: run.id });
    return NextResponse.json({ run });
  } catch (error) {
    return manualErrorResponse(error);
  }
}
