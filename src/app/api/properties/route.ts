import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
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
  const requestId =
    request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id") ??
    request.headers.get("x-vercel-id") ??
    `prop-post-${Date.now()}`;

  const guard = await requirePermission(request, "properties", "insert");
  if (!guard.ok) return guard.response;

  // Checkpoint (a): auth guard passed
  console.log(
    "[PROP_CREATE_DIAG]",
    JSON.stringify({
      event: "post_properties.guard_passed",
      requestId,
      userId: guard.ctx.userId,
      role: guard.ctx.role,
    }),
  );

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    console.error(
      "[PROP_CREATE_DIAG]",
      JSON.stringify({ event: "post_properties.body_parse_failed", requestId }),
    );
    return invalidJsonResponse();
  }

  // Checkpoint (a continued): request body parsed — presence flags only, no PII
  console.log(
    "[PROP_CREATE_DIAG]",
    JSON.stringify({
      event: "post_properties.body_parsed",
      requestId,
      hasName: Boolean(body.name),
      hasCustomer: Boolean(body.customer),
      hasAddress: Boolean(body.address),
      hasCity: Boolean(body.city),
      type: body.type,
      status: body.status,
      primarySystem: body.primarySystem,
    }),
  );

  try {
    const { userId } = guard.ctx;

    // Checkpoint (b): build and validate payload
    let payload: {
      name: string;
      customer: string;
      address: string;
      city: string;
      type: ReturnType<typeof readPropertyType>;
      status: ReturnType<typeof readPropertyStatus>;
      primarySystem: string;
    };
    try {
      payload = {
        name: String(body.name ?? "").trim(),
        customer: String(body.customer ?? "").trim(),
        address: String(body.address ?? "").trim(),
        city: String(body.city ?? "").trim(),
        type: readPropertyType(body.type),
        status: readPropertyStatus(body.status),
        primarySystem: String(body.primarySystem ?? "").trim(),
      };
    } catch (validationError) {
      console.error(
        "[PROP_CREATE_DIAG]",
        JSON.stringify({
          event: "post_properties.payload_validation_failed",
          requestId,
          step: "payload_build",
          errorMessage:
            validationError instanceof Error ? validationError.message : String(validationError),
        }),
      );
      throw validationError;
    }

    // Checkpoint (b): pre-insert payload prepared (sanitized)
    console.log(
      "[PROP_CREATE_DIAG]",
      JSON.stringify({
        event: "post_properties.payload_prepared",
        requestId,
        type: payload.type,
        status: payload.status,
        primarySystem: payload.primarySystem,
        hasName: Boolean(payload.name),
        hasCustomer: Boolean(payload.customer),
        hasAddress: Boolean(payload.address),
        hasCity: Boolean(payload.city),
      }),
    );

    // Checkpoint (c): before service call (encompasses geocode + supabase insert + customer sync)
    console.log(
      "[PROP_CREATE_DIAG]",
      JSON.stringify({
        event: "post_properties.service_call_start",
        requestId,
        userId,
      }),
    );

    const result = await createProperty(payload, { userId });

    // Checkpoint (d): insert succeeded — service returned property
    console.log(
      "[PROP_CREATE_DIAG]",
      JSON.stringify({
        event: "post_properties.service_call_success",
        requestId,
        propertyId: result.property.id,
        geocodeStatus: result.geocodeStatus,
      }),
    );

    // Checkpoint (e): post-insert — audit event
    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "properties",
      resourceId: result.property.id,
      details: {
        geocodeStatus: result.geocodeStatus,
      },
    });

    // Checkpoint (f): final response boundary
    console.log(
      "[PROP_CREATE_DIAG]",
      JSON.stringify({
        event: "post_properties.response_send",
        requestId,
        propertyId: result.property.id,
        statusCode: 201,
      }),
    );

    return NextResponse.json(
      {
        property: result.property,
        geocodeStatus: result.geocodeStatus,
      },
      { status: 201 },
    );
  } catch (error) {
    // Checkpoint: unhandled exception — log full diagnostic context
    const isError = error instanceof Error;
    console.error(
      "[PROP_CREATE_DIAG]",
      JSON.stringify({
        event: "post_properties.unhandled_error",
        requestId,
        errorName: isError ? error.name : typeof error,
        errorMessage: isError ? error.message : String(error),
        errorCode: (error as { code?: string }).code ?? null,
        errorDetails: (error as { details?: unknown }).details ?? null,
        errorHint: (error as { hint?: unknown }).hint ?? null,
        errorStatus: (error as { status?: number }).status ?? null,
        stack: isError ? (error.stack ?? null) : null,
      }),
    );
    return mapRouteError(error);
  }
}