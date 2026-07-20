import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { deleteCustomer, fetchCustomerById, updateCustomer } from "@/services/customers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const customer = await fetchCustomerById(id);

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
  const guard = requirePermission(request, "customers", "update");
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
      name: body.name === undefined ? undefined : String(body.name),
      primaryContact:
        body.primaryContact === undefined ? undefined : String(body.primaryContact),
      email: body.email === undefined ? undefined : String(body.email),
      phone: body.phone === undefined ? undefined : String(body.phone),
      city: body.city === undefined ? undefined : String(body.city),
      status:
        body.status === undefined
          ? undefined
          : (String(body.status) as "Active" | "Prospect" | "Inactive"),
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

    return NextResponse.json({ message: "Customer updated.", customer });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "customers", "delete");
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
