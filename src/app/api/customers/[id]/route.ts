import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { deleteCustomer, getCustomer, updateCustomer } from "@/services/customers";

const CUSTOMER_STATUSES = new Set(["Active", "Prospect", "Inactive"]);

function readOptionalCustomerStatus(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = String(value);
  if (!CUSTOMER_STATUSES.has(normalized)) {
    throw new Error("Invalid customer status.");
  }

  return normalized as "Active" | "Prospect" | "Inactive";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const customer = await getCustomer(id);

    if (!customer) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Customer '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ customer });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "customers", "update");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const { id } = await params;
    const customer = await updateCustomer(id, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      primaryContact:
        body.primaryContact !== undefined ? String(body.primaryContact).trim() : undefined,
      email: body.email !== undefined ? String(body.email).trim() : undefined,
      phone: body.phone !== undefined ? String(body.phone).trim() : undefined,
      city: body.city !== undefined ? String(body.city).trim() : undefined,
      status: readOptionalCustomerStatus(body.status),
    });

    if (!customer) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Customer '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "customers",
      resourceId: id,
      details: body,
    });

    return NextResponse.json({ customer });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "customers", "delete");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const deleted = await deleteCustomer(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Customer '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "delete",
      resource: "customers",
      resourceId: id,
    });

    return NextResponse.json({ message: "Customer deleted.", id });
  } catch (error) {
    return mapRouteError(error);
  }
}
