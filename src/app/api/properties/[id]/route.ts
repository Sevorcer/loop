import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import {
  deleteProperty,
  getProperty,
  updateProperty,
} from "@/services/properties";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let property = null;
  try {
    property = await getProperty(id);
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to load property.",
        code: 500,
      },
      { status: 500 }
    );
  }

  if (!property) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: `Property '${id}' not found.`, code: 404 },
      { status: 404 },
    );
  }

  return NextResponse.json({ property });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;

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
    const updated = await updateProperty(id, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      customer:
        body.customer !== undefined ? String(body.customer).trim() : undefined,
      address:
        body.address !== undefined ? String(body.address).trim() : undefined,
      city: body.city !== undefined ? String(body.city).trim() : undefined,
      type:
        body.type as "Residential" | "Commercial" | "Multi-Family" | undefined,
      status: body.status as "Active" | "Pending" | "Inactive" | undefined,
      primarySystem:
        body.primarySystem !== undefined
          ? String(body.primarySystem).trim()
          : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Property '${id}' not found.`, code: 404 },
        { status: 404 }
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "properties",
      resourceId: id,
      details: { geocodeStatus: updated.geocodeStatus },
    });

    return NextResponse.json({
      property: updated.property,
      geocodeStatus: updated.geocodeStatus,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to update property.",
        code: 500,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "delete");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const deleted = await deleteProperty(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Property '${id}' not found.`, code: 404 },
        { status: 404 }
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
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to delete property.",
        code: 500,
      },
      { status: 500 }
    );
  }
}
