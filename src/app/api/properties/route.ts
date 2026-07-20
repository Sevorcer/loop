import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { createProperty, listProperties } from "@/services/properties";

export async function GET(request: Request) {
  const guard = requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ properties: await listProperties() });
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
      name: String(body.name ?? ""),
      customer: String(body.customer ?? ""),
      address: String(body.address ?? ""),
      city: String(body.city ?? ""),
      type: String(body.type ?? "Residential") as
        | "Residential"
        | "Commercial"
        | "Multi-Family",
      status: String(body.status ?? "Active") as "Active" | "Pending" | "Inactive",
      primarySystem: String(body.primarySystem ?? ""),
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "properties",
      resourceId: result.property.id,
      details: { address: result.property.address },
    });

    return NextResponse.json(
      { message: "Property created.", property: result.property, geocodeStatus: result.geocodeStatus },
      { status: 201 },
    );
  } catch (error) {
    return mapRouteError(error);
  }
}
