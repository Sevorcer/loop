import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { mockCustomers } from "@/features/customers/data/mockCustomers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const customer = mockCustomers.find((c) => c.id === id);

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

  emitAuditEvent({
    role: guard.ctx.role,
    action: "update",
    resource: "customers",
    resourceId: id,
    details: body,
  });

  // TODO: persist to Supabase when wired
  return NextResponse.json({ message: "Customer updated.", id });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "customers", "delete");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  emitAuditEvent({
    role: guard.ctx.role,
    action: "delete",
    resource: "customers",
    resourceId: id,
  });

  // TODO: persist to Supabase when wired
  return NextResponse.json({ message: "Customer deleted.", id });
}
