import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  extractSupabaseError,
  getPostRequestTrace,
} from "@/lib/api/postFailureTelemetry";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emitAuditEvent } from "@/lib/audit";
import { createProperty, listProperties } from "@/services/properties";

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

export async function GET(request: Request) {
  const guard = await requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  try {
    const { userId } = guard.ctx;
    const properties = await listProperties({ userId });
    return NextResponse.json({ properties });
  } catch (error) {
    return mapRouteError(error);
  }
}


export async function POST(request: Request) {
  let requestId: string | undefined;
  let step: string | undefined;

  try {
    requestId = getPostRequestTrace(request, "prop-post").requestId;
    step = "permission_guard";
    const route = "/api/properties";
    let body: Record<string, unknown> = {};

    const guard = await requirePermission(request, "properties", "insert");
    if (!guard.ok) return guard.response;

    step = "body_parse";
    body = await readJsonObject(request);

    const { userId } = guard.ctx;
    step = "payload_build";

    const payload = {
      name: String(body.name ?? "").trim(),
      customer: String(body.customer ?? "").trim(),
      address: String(body.address ?? "").trim(),
      city: String(body.city ?? "").trim(),
      type: readPropertyType(body.type),
      status: readPropertyStatus(body.status),
      primarySystem: String(body.primarySystem ?? "").trim(),
    };

    step = "build_supabase_client";
    const supabase = await createSupabaseServerClient();

    step = "create_property_service";
    const result = await createProperty(payload, {
      userId,
      supabase,
      route,
      requestId,
    });

    step = "audit_event";
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
    const route = "/api/properties";
    const tracedRequestId = requestId ?? getPostRequestTrace(request, "prop-post").requestId;
    const isError = error instanceof Error;
    const supabaseError = extractSupabaseError(error);

    console.error("API_POST_FAILURE", {
      route,
      requestId: tracedRequestId,
      step,
      name: isError ? error.name : typeof error,
      message: isError ? error.message : String(error),
      stack: isError ? (error.stack ?? null) : null,
      ...(supabaseError.code ? { code: supabaseError.code } : {}),
      ...(supabaseError.details !== null ? { details: supabaseError.details } : {}),
      ...(supabaseError.hint !== null ? { hint: supabaseError.hint } : {}),
      ...(supabaseError.status !== null ? { status: supabaseError.status } : {}),
    });

    if (step === "body_parse") {
      return invalidJsonResponse();
    }

    return mapRouteError(error);
  }
}