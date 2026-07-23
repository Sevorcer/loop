import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteProperty, getProperty, updateProperty } from "@/services/properties";

const PROPERTY_TYPES = new Set(["Residential", "Commercial", "Multi-Family"]);
const PROPERTY_STATUSES = new Set(["Active", "Pending", "Inactive"]);

function readOptionalPropertyType(value: unknown) {
  if (value === undefined) return undefined;
  const normalized = String(value);
  if (!PROPERTY_TYPES.has(normalized)) throw new Error("Invalid property type.");
  return normalized as "Residential" | "Commercial" | "Multi-Family";
}

function readOptionalPropertyStatus(value: unknown) {
  if (value === undefined) return undefined;
  const normalized = String(value);
  if (!PROPERTY_STATUSES.has(normalized)) throw new Error("Invalid property status.");
  return normalized as "Active" | "Pending" | "Inactive";
}

async function getAuthenticatedUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return null;
  }

  return user.id;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "A valid session is required.", code: 401 },
        { status: 401 },
      );
    }

    const { id } = await params;
    const property = await getProperty(id, { userId });

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
  const guard = await requirePermission(request, "properties", "update");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "A valid session is required.", code: 401 },
        { status: 401 },
      );
    }

    const { id } = await params;
    const updated = await updateProperty(
      id,
      {
        name: body.name !== undefined ? String(body.name).trim() : undefined,
        customer: body.customer !== undefined ? String(body.customer).trim() : undefined,
        address: body.address !== undefined ? String(body.address).trim() : undefined,
        city: body.city !== undefined ? String(body.city).trim() : undefined,
        type: readOptionalPropertyType(body.type),
        status: readOptionalPropertyStatus(body.status),
        primarySystem:
          body.primarySystem !== undefined ? String(body.primarySystem).trim() : undefined,
      },
      { userId },
    );

    if (!updated) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Property '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "properties",
      resourceId: id,
      details: {
        ...body,
        geocodeStatus: updated.geocodeStatus,
      },
    });

    return NextResponse.json({
      property: updated.property,
      geocodeStatus: updated.geocodeStatus,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "properties", "delete");
  if (!guard.ok) return guard.response;

  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "A valid session is required.", code: 401 },
        { status: 401 },
      );
    }

    const { id } = await params;
    const deleted = await deleteProperty(id, { userId });

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