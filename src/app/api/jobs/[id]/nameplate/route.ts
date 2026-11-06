import { NextResponse } from "next/server";

import {
  decideNameplateSave,
  isNameplateSaveAttempt,
  mergeConfirmedSerial,
  resolveNameplateSystem,
  reviewFromExtraction,
} from "@/features/installed-systems/utils/nameplateRead";
import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, invalidJsonResponse, mapRouteError } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { isUuid } from "@/lib/manuals/routeHelpers";
import { logWriteFailure } from "@/lib/observability/writes";
import { loadInstalledSystemsForJob } from "@/repositories/installedSystems";
import { searchJobPhotosForNameplate } from "@/services/jobNameplate";
import { updateInstalledSystem } from "@/services/installedSystems";
import { tryAutoMatchManualsForSystem } from "@/services/manualAutoMatch";

import { jobFileTechAssignmentResponse } from "../files/uploadGuard";

/**
 * POST /api/jobs/[id]/nameplate
 *
 * {} searches the photos already on this job and returns a suggestion.
 * It does not write model or serial.
 *
 * { confirm: true, modelNumber, serialNumber, installedSystemId? } saves
 * the reviewed values onto an installed system that belongs to this job.
 * One system is used automatically. Several systems require a choice.
 *
 * Permission matches adding a job photo: jobs update, and a technician
 * must be assigned to the job.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return createApiErrorResponse("VALIDATION", "A valid job id is required.", 400);
  }
  const techBlock = await jobFileTechAssignmentResponse(guard.ctx, id);
  if (techBlock) return techBlock;

  let body: Record<string, unknown> = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return invalidJsonResponse();
      }
    } catch {
      return invalidJsonResponse();
    }
  }

  try {
    if (isNameplateSaveAttempt(body)) {
      const decision = decideNameplateSave(body);
      if (!decision.ok) {
        return createApiErrorResponse("VALIDATION", decision.message, 400);
      }

      const snapshot = await loadInstalledSystemsForJob(id);
      const target = resolveNameplateSystem(snapshot.installedSystems, body.installedSystemId);
      if (!target.ok) {
        return createApiErrorResponse("VALIDATION", target.message, 400);
      }
      const system = snapshot.installedSystems.find((item) => item.id === target.id);
      if (!system) {
        return createApiErrorResponse("VALIDATION", "That installed system is not on this job. Nothing was changed.", 400);
      }

      const updated = await updateInstalledSystem(system.id, {
        modelNumber: decision.modelNumber,
        serialNumbers: mergeConfirmedSerial(system.serialNumbers, decision.serialNumber),
      });
      if (!updated) {
        return createApiErrorResponse("NOT_FOUND", "Installed system not found.", 404);
      }

      emitAuditEvent({
        role: guard.ctx.role,
        action: "update",
        resource: "installed_systems",
        resourceId: system.id,
      });

      const manualMatch = await tryAutoMatchManualsForSystem(system.id);
      return NextResponse.json({ saved: true, installedSystem: updated, manualMatch });
    }

    const found = await searchJobPhotosForNameplate(id, guard.ctx.role);
    const systems = (await loadInstalledSystemsForJob(id)).installedSystems.map((system) => ({
      id: system.id,
      systemName: system.systemName,
      modelNumber: system.modelNumber,
      serialNumber: system.serialNumbers[0] ?? "",
    }));
    const only = systems.length === 1 ? systems[0] : null;
    const review = reviewFromExtraction({
      existingModel: only?.modelNumber ?? "",
      existingSerial: only?.serialNumber ?? "",
      extraction: found.extraction,
    });

    return NextResponse.json({
      saved: false,
      review,
      extraction: found.extraction,
      photoFileName: found.photoFileName,
      systems,
    });
  } catch (error) {
    logWriteFailure({ route: "/api/jobs/[id]/nameplate", request }, error);
    return mapRouteError(error);
  }
}
