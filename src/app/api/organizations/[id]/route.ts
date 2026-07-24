import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  readJsonObject,
} from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { logWriteFailure } from "@/lib/observability/writes";
import {
  mapOrganizationRouteError,
  organizationNotFound,
  organizationPermissionDenied,
  organizationValidationFailed,
} from "@/lib/organizationsApiErrors";
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
  const guard = await requirePermission(request, "organizations", "select");
  if (!guard.ok) {
    const denied = organizationPermissionDenied(guard.response.status);
    return NextResponse.json(denied.error, { status: denied.status });
  }

  try {
    const { id } = await params;
    const organization = await getOrganization(id);

    if (!organization) {
      const notFound = organizationNotFound(id);
      return NextResponse.json(notFound.error, { status: notFound.status });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    const mapped = mapOrganizationRouteError(error);
    return NextResponse.json(mapped.error, { status: mapped.status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "organizations", "update");
  if (!guard.ok) {
    const denied = organizationPermissionDenied(guard.response.status);
    return NextResponse.json(denied.error, { status: denied.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    const validation = organizationValidationFailed({
      _root: ["Request body must be valid JSON."],
    });
    return NextResponse.json(validation.error, { status: validation.status });
  }

  const parsed = UpdateOrganizationSchema.safeParse(body);

  if (!parsed.success) {
    const validation = organizationValidationFailed(parsed.error.flatten().fieldErrors);
    return NextResponse.json(validation.error, { status: validation.status });
  }

  try {
    const { id } = await params;
    const organization = await updateOrganization(id, parsed.data);

    if (!organization) {
      const notFound = organizationNotFound(id);
      return NextResponse.json(notFound.error, { status: notFound.status });
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
    logWriteFailure({ route: "/api/organizations/[id]", request }, error);
    const mapped = mapOrganizationRouteError(error);
    return NextResponse.json(mapped.error, { status: mapped.status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "organizations", "delete");
  if (!guard.ok) {
    const denied = organizationPermissionDenied(guard.response.status);
    return NextResponse.json(denied.error, { status: denied.status });
  }

  try {
    const { id } = await params;
    const deleted = await deleteOrganization(id);

    if (!deleted) {
      const notFound = organizationNotFound(id);
      return NextResponse.json(notFound.error, { status: notFound.status });
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "delete",
      resource: "organizations",
      resourceId: id,
    });

    return NextResponse.json({ message: "Organization deleted.", id });
  } catch (error) {
    logWriteFailure({ route: "/api/organizations/[id]", request }, error);
    const mapped = mapOrganizationRouteError(error);
    return NextResponse.json(mapped.error, { status: mapped.status });
  }
}
