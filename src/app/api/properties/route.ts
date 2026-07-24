import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  extractSupabaseError,
  getPostRequestTrace,
} from "@/lib/api/postFailureTelemetry";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
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

  console.log(
    "[AUTH_FLOW]",
    JSON.stringify({
      event: "guard.pass",
      route: "/api/properties",
      userId: guard.ctx.userId,
      role: guard.ctx.role,
      requestId:
        request.headers.get("x-request-id") ??
        request.headers.get("x-correlation-id") ??
        request.headers.get("x-vercel-id") ??
        undefined,
    }),
  );

  try {
    const { userId } = guard.ctx;
    const properties = await listProperties({ userId });
    return NextResponse.json({ properties });
  } catch (error) {
    return mapRouteError(error);
  }
}


export async function POST(request: Request) {
  const { requestId } = getPostRequestTrace(request, "prop-post");
  const route = "/api/properties";
  const method = "POST";
  let step = "permission_guard";
  let body: Record<string, unknown> = {};

  try {
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

    step = "before_insert";
    console.error("API_POST_CHECKPOINT", { route, step: "before_insert", requestId });

    step = "create_property_service";
    const result = await createProperty(payload, { userId });

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
    const isError = error instanceof Error;
    const supabaseError = extractSupabaseError(error);
    const supabase: {
      code?: string;
      details?: unknown;
      hint?: unknown;
      status?: number;
    } = {};

    if (supabaseError.code) supabase.code = supabaseError.code;
    if (supabaseError.details !== null) supabase.details = supabaseError.details;
    if (supabaseError.hint !== null) supabase.hint = supabaseError.hint;
    if (supabaseError.status !== null) supabase.status = supabaseError.status;

    console.error("API_POST_FAILURE", {
      route,
      method,
      requestId,
      step,
      errorName: isError ? error.name : typeof error,
      errorMessage: isError ? error.message : String(error),
      errorStack: isError ? (error.stack ?? null) : null,
      ...(Object.keys(supabase).length > 0 ? { supabase } : {}),
    });

    if (step === "body_parse") {
      return invalidJsonResponse();
    }

    return mapRouteError(error);
  }
}