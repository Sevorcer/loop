import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  getPostRequestTrace,
} from "@/lib/api/postFailureTelemetry";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emitAuditEvent } from "@/lib/audit";
import { logWriteFailure } from "@/lib/observability/writes";
import { propertiesMatchingQuery } from "@/features/jobs/utils/propertyPicker";
import { createProperty, listProperties, listPropertiesForCustomer } from "@/services/properties";

const PROPERTY_TYPES = new Set(["Residential", "Commercial", "Multi-Family"]);
const PROPERTY_STATUSES = new Set(["Active", "Pending", "Inactive"]);

function readPropertyType(value: unknown) {
  const normalized = String(value);
  if (!PROPERTY_TYPES.has(normalized)) {
    throw new Error("Invalid property type.");
  }

  return normalized as "Residential" | "Commercial" | "Multi-Family";
}

function readPropertyStatus(value: unknown) {
  const normalized = String(value);
  if (!PROPERTY_STATUSES.has(normalized)) {
    throw new Error("Invalid property status.");
  }

  return normalized as "Active" | "Pending" | "Inactive";
}

/** Optional list query params: invalid values are ignored, not errors. */
function readListPageParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined;
}

function readOptionalPropertyStatus(value: string | null) {
  if (!value || !PROPERTY_STATUSES.has(value)) return undefined;
  return value as "Active" | "Pending" | "Inactive";
}

function readOptionalPropertyType(value: string | null) {
  if (!value || !PROPERTY_TYPES.has(value)) return undefined;
  return value as "Residential" | "Commercial" | "Multi-Family";
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  try {
    const { userId } = guard.ctx;
    const params = new URL(request.url).searchParams;
    const search = params.get("search") ?? undefined;
    const customerId = params.get("customerId") ?? undefined;
    if (customerId) {
      const owned = await listPropertiesForCustomer(customerId, { userId }, { pageSize: 200 });
      const properties = search ? propertiesMatchingQuery(owned, search) : owned;
      return NextResponse.json({ properties, total: properties.length });
    }
    const result = await listProperties({ userId }, {
      search,
      page: readListPageParam(params.get("page")),
      pageSize: readListPageParam(params.get("pageSize")),
      status: readOptionalPropertyStatus(params.get("status")),
      type: readOptionalPropertyType(params.get("type")),
      city: params.get("city") ?? undefined,
    });
    return NextResponse.json({
      properties: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}


export async function POST(request: Request) {
  const route = "/api/properties";
  const operation = "create_property";
  let requestId: string | undefined;

  try {
    requestId = getPostRequestTrace(request, "prop-post").requestId;
    let body: Record<string, unknown> = {};

    const guard = await requirePermission(request, "properties", "insert");
    if (!guard.ok) return guard.response;

    body = await readJsonObject(request);

    const { userId } = guard.ctx;

    const payload: {
      name: string;
      customer: string;
      customerId?: string;
      address: string;
      city: string;
      type: "Residential" | "Commercial" | "Multi-Family";
      status: "Active" | "Pending" | "Inactive";
      primarySystem: string;
    } = {
      name: String(body.name ?? "").trim(),
      customer: String(body.customer ?? "").trim(),
      address: String(body.address ?? "").trim(),
      city: String(body.city ?? "").trim(),
      type: readPropertyType(body.type),
      status: readPropertyStatus(body.status),
      primarySystem: String(body.primarySystem ?? "").trim(),
    };
    if (typeof body.customerId === "string" && body.customerId.trim()) {
      payload.customerId = body.customerId.trim();
    }

    const supabase = await createSupabaseServerClient();

    const result = await createProperty(payload, {
      userId,
      supabase,
      route,
      requestId,
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "properties",
      resourceId: result.property.id,
      details: {
        geocodeStatus: result.geocodeStatus,
      },
    });

    return NextResponse.json(
      {
        property: result.property,
        geocodeStatus: result.geocodeStatus,
      },
      { status: 201 },
    );
  } catch (error) {
    const tracedRequestId = requestId ?? getPostRequestTrace(request, "prop-post").requestId;

    logWriteFailure({ route, operation, requestId: tracedRequestId }, error);

    if (error instanceof SyntaxError) {
      return invalidJsonResponse();
    }

    return mapRouteError(error);
  }
}