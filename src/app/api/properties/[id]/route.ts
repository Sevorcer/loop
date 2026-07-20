import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { deleteProperty, fetchPropertyById, updateProperty } from "@/services/properties";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const property = await fetchPropertyById(id);

    if (!property) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Property '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ property });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "update");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const { id } = await params;
    const existing = await fetchPropertyById(id);

    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Property '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    const result = await updateProperty(existing, {
      name: body.name === undefined ? undefined : String(body.name),
      customer: body.customer === undefined ? undefined : String(body.customer),
      address: body.address === undefined ? undefined : String(body.address),
      city: body.city === undefined ? undefined : String(body.city),
      type:
        body.type === undefined
          ? undefined
          : (String(body.type) as "Residential" | "Commercial" | "Multi-Family"),
      status:
        body.status === undefined
          ? undefined
          : (String(body.status) as "Active" | "Pending" | "Inactive"),
      primarySystem:
        body.primarySystem === undefined ? undefined : String(body.primarySystem),
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "properties",
      resourceId: id,
      details: body,
    });

    return NextResponse.json({
      message: "Property updated.",
      property: result.property,
      geocodeStatus: result.geocodeStatus,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "delete");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const deleted = await deleteProperty(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Property '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "delete",
      resource: "properties",
      resourceId: id,
    });

    return NextResponse.json({ message: "Property deleted.", id });
  } catch (error) {
    return mapRouteError(error);
  }
}
