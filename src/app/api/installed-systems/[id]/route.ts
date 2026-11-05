/**
 * Individual installed system operations.
 *
 * GET    /api/installed-systems/[id]
 * PATCH  /api/installed-systems/[id]
 * DELETE /api/installed-systems/[id]
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, invalidJsonResponse, mapRepositoryError, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { getCurrentOperator } from "@/services/currentOperator";
import { getInstalledSystemById } from "@/repositories/installedSystems";
import { tryAutoMatchManualsForSystem } from "@/services/manualAutoMatch";
import {
  deleteInstalledSystem,
  updateInstalledSystem,
} from "@/services/installedSystems";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermission(request, "installed_systems", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const result = await getInstalledSystemById(id);
    if (!result.ok) {
      return mapRepositoryError(result.error);
    }
    if (!result.data) {
      return createApiErrorResponse("NOT_FOUND", `Installed system ${id} not found.`, 404);
    }
    return NextResponse.json({ installedSystem: result.data });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermission(request, "installed_systems", "update");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const { id } = await params;

  try {
    const patch: Parameters<typeof updateInstalledSystem>[1] = {};

    if (typeof body.systemName === "string") patch.systemName = body.systemName.trim();
    if (typeof body.customerName === "string") patch.customerName = body.customerName.trim();
    if (typeof body.propertyName === "string") patch.propertyName = body.propertyName.trim();
    if (typeof body.location === "string") patch.location = body.location.trim();
    if (typeof body.installDate === "string") patch.installDate = body.installDate.trim();
    if (typeof body.manufacturer === "string") patch.manufacturer = body.manufacturer.trim();
    if (typeof body.modelNumber === "string") patch.modelNumber = body.modelNumber.trim();
    if (typeof body.warrantyExpiry === "string") {
      // Same office-only rule as warranty registration (field feedback 2026-11-05).
      if (!["owner", "manager", "office", "dispatch"].includes(guard.ctx.role)) {
        return createApiErrorResponse(
          "FORBIDDEN",
          "Only office staff can set warranty expiry.",
          403,
        );
      }
      patch.warrantyExpiry = body.warrantyExpiry.trim();
    }
    if (typeof body.warrantyRegistered === "boolean") {
      // Warranty registration is office-only (per Collin, 2026-10-02). The DB
      // trigger guard_tech_installed_system_warranty enforces this at the data
      // layer; reject it here too so a technician gets a clear 403 instead of a
      // raw database error.
      if (guard.ctx.role === "tech") {
        return createApiErrorResponse(
          "FORBIDDEN",
          "Technicians cannot change warranty registration.",
          403,
        );
      }
      patch.warrantyRegistered = body.warrantyRegistered;
      if (body.warrantyRegistered) {
        patch.warrantyRegisteredAt = new Date().toISOString();
        // Record who marked it registered (the field was never set before).
        const operator = await getCurrentOperator();
        patch.warrantyRegisteredBy = operator.name;
      } else {
        patch.warrantyRegisteredAt = undefined;
        patch.warrantyRegisteredBy = undefined;
      }
    }
    if (Array.isArray(body.serialNumbers)) {
      patch.serialNumbers = (body.serialNumbers as unknown[]).filter(
        (s): s is string => typeof s === "string",
      );
    }
    if (
      typeof body.lifecycleStatus === "string" &&
      ["Planned", "Active", "Needs Review"].includes(body.lifecycleStatus)
    ) {
      patch.lifecycleStatus = body.lifecycleStatus as "Planned" | "Active" | "Needs Review";
    }
    if (typeof body.propertyId === "string") {
      patch.propertyId = body.propertyId.trim() || undefined;
    }

    const updated = await updateInstalledSystem(id, patch);

    if (!updated) {
      return createApiErrorResponse("NOT_FOUND", `Installed system ${id} not found.`, 404);
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "installed_systems",
      resourceId: id,
    });

    // #8 Copilot: a brand/model edit re-runs the manual auto-match.
    const manualMatch =
      patch.manufacturer !== undefined || patch.modelNumber !== undefined || patch.systemName !== undefined
        ? await tryAutoMatchManualsForSystem(id)
        : undefined;

    return NextResponse.json(
      manualMatch === undefined ? { installedSystem: updated } : { installedSystem: updated, manualMatch },
    );
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermission(request, "installed_systems", "delete");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const deleted = await deleteInstalledSystem(id);

    if (!deleted) {
      return createApiErrorResponse("NOT_FOUND", `Installed system ${id} not found.`, 404);
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "delete",
      resource: "installed_systems",
      resourceId: id,
    });

    return NextResponse.json({ message: "Installed system deleted.", id });
  } catch (error) {
    return mapRouteError(error);
  }
}
