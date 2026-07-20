import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { createProperty, listProperties } from "@/services/properties";

export async function GET(request: Request) {
  const guard = requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  try {
    const properties = await listProperties();
    return NextResponse.json({ properties });
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to load properties.",
        code: 500,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const guard = requirePermission(request, "properties", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", message: "Request body must be valid JSON.", code: 400 },
      { status: 400 },
    );
  }

  try {
    const result = await createProperty({
      name: String(body.name ?? "").trim(),
      customer: String(body.customer ?? "").trim(),
      address: String(body.address ?? "").trim(),
      city: String(body.city ?? "").trim(),
      type:
        (body.type as "Residential" | "Commercial" | "Multi-Family") ??
        "Residential",
      status: (body.status as "Active" | "Pending" | "Inactive") ?? "Active",
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
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to create property.",
        code: 500,
      },
      { status: 500 }
    );
  }
}
