import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import {
  deleteCustomer,
  getCustomer,
  updateCustomer,
} from "@/services/customers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let customer = null;
  try {
    customer = await getCustomer(id);
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to load customer.",
        code: 500,
      },
      { status: 500 }
    );
  }

  if (!customer) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: `Customer '${id}' not found.`, code: 404 },
      { status: 404 },
    );
  }

  return NextResponse.json({ customer });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "customers", "update");
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
    const customer = await updateCustomer(id, {
      name:
        body.name !== undefined ? String(body.name).trim() : undefined,
      primaryContact:
        body.primaryContact !== undefined
          ? String(body.primaryContact).trim()
          : undefined,
      email: body.email !== undefined ? String(body.email).trim() : undefined,
      phone: body.phone !== undefined ? String(body.phone).trim() : undefined,
      city: body.city !== undefined ? String(body.city).trim() : undefined,
      status: body.status as "Active" | "Prospect" | "Inactive" | undefined,
    });

    if (!customer) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Customer '${id}' not found.`, code: 404 },
        { status: 404 }
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
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to update customer.",
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
  const guard = requirePermission(request, "customers", "delete");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const deleted = await deleteCustomer(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Customer '${id}' not found.`, code: 404 },
        { status: 404 }
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
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to delete customer.",
        code: 500,
      },
      { status: 500 }
    );
  }
}
