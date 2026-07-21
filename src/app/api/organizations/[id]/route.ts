import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import {
  UpdateOrganizationSchema,
  deleteOrganization,
  getOrganization,
  updateOrganization,
} from "@/services/organizations";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "organizations", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const organization = await getOrganization(id);

    if (!organization) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Organization '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ organization });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "organizations", "update");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = UpdateOrganizationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: "Validation failed.",
        fieldErrors: parsed.error.flatten().fieldErrors,
        code: 400,
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const organization = await updateOrganization(id, parsed.data);

    if (!organization) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Organization '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "organizations",
      resourceId: id,
      details: parsed.data,
    });

    return NextResponse.json({ organization });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "organizations", "delete");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const deleted = await deleteOrganization(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Organization '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "delete",
      resource: "organizations",
      resourceId: id,
    });

    return NextResponse.json({ message: "Organization deleted.", id });
  } catch (error) {
    return mapRouteError(error);
  }
}
