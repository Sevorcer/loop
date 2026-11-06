import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { isUuid } from "@/lib/manuals/routeHelpers";
import { logWriteFailure } from "@/lib/observability/writes";
import {
  decideNameplateSave,
  isNameplateSaveAttempt,
  mergeConfirmedSerial,
} from "@/features/installed-systems/utils/nameplateRead";
import { getInstalledSystemById } from "@/repositories/installedSystems";
import { reviewNameplatePhoto } from "@/services/installedSystemNameplate";
import { updateInstalledSystem } from "@/services/installedSystems";
import { tryAutoMatchManualsForSystem } from "@/services/manualAutoMatch";

/**
 * POST /api/installed-systems/[id]/nameplate
 *
 * { photoId } reads a nameplate photo and returns a suggestion. It does not
 * write model or serial.
 *
 * { confirm: true, modelNumber, serialNumber } saves the reviewed values.
 * Any other body that includes model, serial, or confirm is refused.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "installed_systems", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return createApiErrorResponse("VALIDATION", "A valid installed system id is required.", 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    if (isNameplateSaveAttempt(body)) {
      const decision = decideNameplateSave(body);
      if (!decision.ok) {
        return createApiErrorResponse("VALIDATION", decision.message, 400);
      }

      const current = await getInstalledSystemById(id);
      if (!current.ok) {
        return mapRouteError(new Error(current.error.message));
      }
      if (!current.data) {
        return createApiErrorResponse("NOT_FOUND", "Installed system not found.", 404);
      }

      const updated = await updateInstalledSystem(id, {
        modelNumber: decision.modelNumber,
        serialNumbers: mergeConfirmedSerial(current.data.serialNumbers, decision.serialNumber),
      });
      if (!updated) {
        return createApiErrorResponse("NOT_FOUND", "Installed system not found.", 404);
      }

      emitAuditEvent({
        role: guard.ctx.role,
        action: "update",
        resource: "installed_systems",
        resourceId: id,
      });

      const manualMatch = await tryAutoMatchManualsForSystem(id);
      return NextResponse.json({ saved: true, installedSystem: updated, manualMatch });
    }

    const photoId = typeof body.photoId === "string" ? body.photoId : "";
    if (!isUuid(photoId)) {
      return createApiErrorResponse("VALIDATION", "Choose a photo to read.", 400);
    }

    const result = await reviewNameplatePhoto(id, photoId);
    if (!result.ok) {
      return createApiErrorResponse("NOT_FOUND", result.message, result.status);
    }
    return NextResponse.json({ saved: false, review: result.review });
  } catch (error) {
    logWriteFailure({ route: "/api/installed-systems/[id]/nameplate", request }, error);
    return mapRouteError(error);
  }
}
