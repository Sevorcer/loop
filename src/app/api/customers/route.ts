import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { createCustomer, listCustomers } from "@/services/customers";

export async function GET(request: Request) {
  const guard = requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  try {
    const customers = await listCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to load customers.",
        code: 500,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const guard = requirePermission(request, "customers", "insert");
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
    const customer = await createCustomer({
      name: String(body.name ?? "").trim(),
      primaryContact: String(body.primaryContact ?? "").trim(),
      email: String(body.email ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      city: String(body.city ?? "").trim(),
      status: (body.status as "Active" | "Prospect" | "Inactive") ?? "Active",
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "customers",
      resourceId: customer.id,
      details: { name: customer.name },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to create customer.",
        code: 500,
      },
      { status: 500 }
    );
  }
}
