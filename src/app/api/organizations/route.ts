import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  readJsonObject,
} from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { logWriteFailure } from "@/lib/observability/writes";
import {
  mapOrganizationRouteError,
  organizationValidationFailed,
} from "@/lib/organizationsApiErrors";
import {
  CreateOrganizationSchema,
  ListOrganizationsQuerySchema,
  createOrganization,
  listOrganizations,
} from "@/services/organizations";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "organizations", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());
  const parsed = ListOrganizationsQuerySchema.safeParse(rawParams);

  if (!parsed.success) {
    const validation = organizationValidationFailed(parsed.error.flatten().fieldErrors);
    return NextResponse.json(validation.error, { status: validation.status });
  }

  try {
    const result = await listOrganizations(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapOrganizationRouteError(error);
    return NextResponse.json(mapped.error, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "organizations", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    const validation = organizationValidationFailed({
      _root: ["Request body must be valid JSON."],
    });
    return NextResponse.json(validation.error, { status: validation.status });
  }

  const parsed = CreateOrganizationSchema.safeParse(body);

  if (!parsed.success) {
    const validation = organizationValidationFailed(parsed.error.flatten().fieldErrors);
    return NextResponse.json(validation.error, { status: validation.status });
  }

  try {
    const organization = await createOrganization(parsed.data);

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "organizations",
      resourceId: organization.id,
      details: { name: organization.name },
    });

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    logWriteFailure({ route: "/api/organizations", request }, error);
    const mapped = mapOrganizationRouteError(error);
    return NextResponse.json(mapped.error, { status: mapped.status });
  }
}
