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

export async function GET(request: Request) {
  const guard = requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  try {
    const properties = await listProperties();
    return NextResponse.json({ properties });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = requirePermission(request, "properties", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
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

    return NextResponse.json(
      { property: result.property, geocodeStatus: result.geocodeStatus },
      { status: 201 },
    );
  } catch (error) {
    return mapRouteError(error);
  }
}
