import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  createApiErrorResponse,
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import {
  CreateOrganizationSchema,
  ListOrganizationsQuerySchema,
  createOrganization,
  listOrganizations,
} from "@/services/organizations";

export async function GET(request: Request) {
  const guard = requirePermission(request, "organizations", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());
  const parsed = ListOrganizationsQuerySchema.safeParse(rawParams);

  if (!parsed.success) {
    return createApiErrorResponse(
      "VALIDATION_ERROR",
      "Invalid query parameters.",
      400,
    );
  }

  try {
    const result = await listOrganizations(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = requirePermission(request, "organizations", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = CreateOrganizationSchema.safeParse(body);

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
    return mapRouteError(error);
  }
}
