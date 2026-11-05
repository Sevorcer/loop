/**
 * Installed system manuals — #32
 *
 * GET  /api/installed-systems/[id]/manuals — linked manuals, live
 *      suggestions (with confidence + reason) and auto-placed info.
 *      Roles: owner, manager, dispatch, office, sales, tech. portal denied.
 * POST /api/installed-systems/[id]/manuals — office decision on one manual.
 *      Body: { manualId, action: "confirm" | "unlink" | "clear" }.
 *      Roles: owner, manager, dispatch, office.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { canManageManuals, canReadManuals } from "@/features/manuals/utils/manualRoles";
import {
  forbiddenResponse,
  invalidIdResponse,
  isUuid,
  manualErrorResponse,
  readManualBody,
} from "@/lib/manuals/routeHelpers";
import {
  decideInstalledSystemManual,
  getInstalledSystemManuals,
} from "@/services/installedSystemManuals";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "installed_systems", "select");
  if (!guard.ok) return guard.response;
  if (!canReadManuals(guard.ctx.role)) return forbiddenResponse("You cannot view manuals.");

  const { id } = await params;
  if (!isUuid(id)) return invalidIdResponse("Installed system id");

  try {
    const manuals = await getInstalledSystemManuals(id, guard.ctx.role);
    if (!manuals) return createApiErrorResponse("NOT_FOUND", "Installed system not found.", 404);
    return NextResponse.json({ manuals });
  } catch (error) {
    return manualErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "installed_systems", "select");
  if (!guard.ok) return guard.response;
  if (!canManageManuals(guard.ctx.role)) {
    return forbiddenResponse("Only office staff can confirm or unlink manuals.");
  }

  const { id } = await params;
  if (!isUuid(id)) return invalidIdResponse("Installed system id");

  const parsed = await readManualBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await decideInstalledSystemManual(id, parsed.body);
    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "installed_system_manuals",
      resourceId: id,
      details: { manualId: parsed.body.manualId, action: parsed.body.action },
    });
    return NextResponse.json({ result });
  } catch (error) {
    return manualErrorResponse(error);
  }
}
