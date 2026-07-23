import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { createProperty, listProperties } from "@/services/properties";

const PROPERTY_TYPES = new Set(["Residential", "Commercial", "Multi-Family"]);
const PROPERTY_STATUSES = new Set(["Active", "Pending", "Inactive"]);

function readPropertyType(value: unknown) {
  const normalized = String(value ?? "Residential");
  if (!PROPERTY_TYPES.has(normalized)) {
    throw new Error("Invalid property type.");
  }
  return normalized as "Residential" | "Commercial" | "Multi-Family";
}

function readPropertyStatus(value: unknown) {
  const normalized = String(value ?? "Active");
  if (!PROPERTY_STATUSES.has(normalized)) {
    throw new Error("Invalid property status.");
  }
  return normalized as "Active" | "Pending" | "Inactive";
}

function diag(event: string, payload: Record<string, unknown> = {}) {
  console.log("[AUTH_DIAG]", JSON.stringify({ event, route: "/api/properties", ...payload }));
}

function errInfo(error: unknown) {
  if (error && typeof error === "object") {
    const e = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      status?: unknown;
      name?: unknown;
    };
    return {
      name: typeof e.name === "string" ? e.name : null,
      message: typeof e.message === "string" ? e.message : String(e.message ?? "unknown"),
      code: typeof e.code === "string" ? e.code : null,
      details: e.details ?? null,
      hint: e.hint ?? null,
      status: typeof e.status === "number" ? e.status : null,
    };
  }
  return { name: null, message: String(error), code: null, details: null, hint: null, status: null };
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  diag("properties.get.guard_passed", { role: guard.ctx.role });

  try {
    diag("properties.get.list.start");
    const properties = await listProperties();
    diag("properties.get.list.success", { count: Array.isArray(properties) ? properties.length : null });
    return NextResponse.json({ properties });
  } catch (error) {
    const info = errInfo(error);
    diag("properties.get.list.error", info);

    const mapped = mapRouteError(error);
    diag("properties.get.error.mapped", {
      status: mapped.status,
      statusText: mapped.statusText,
    });

    return mapped;
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "properties", "insert");
  if (!guard.ok) return guard.response;

  diag("properties.post.guard_passed", { role: guard.ctx.role });

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    diag("properties.post.invalid_json");
    return invalidJsonResponse();
  }

  try {
    diag("properties.post.create.start");
    const result = await createProperty({
      name: String(body.name ?? "").trim(),
      customer: String(body.customer ?? "").trim(),
      address: String(body.address ?? "").trim(),
      city: String(body.city ?? "").trim(),
      type: readPropertyType(body.type),
      status: readPropertyStatus(body.status),
      primarySystem: String(body.primarySystem ?? "").trim(),
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "properties",
      resourceId: result.property.id,
      details: {
        address: result.property.address,
        geocodeStatus: result.geocodeStatus,
      },
    });

    diag("properties.post.create.success", {
      propertyId: result.property.id,
      geocodeStatus: result.geocodeStatus,
    });

    return NextResponse.json(
      { property: result.property, geocodeStatus: result.geocodeStatus },
      { status: 201 },
    );
  } catch (error) {
    const info = errInfo(error);
    diag("properties.post.create.error", info);

    const mapped = mapRouteError(error);
    diag("properties.post.error.mapped", {
      status: mapped.status,
      statusText: mapped.statusText,
    });

    return mapped;
  }
}