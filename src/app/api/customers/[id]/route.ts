import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { createRepositoryErrorBody } from "@/lib/repositories/http";
import { createCustomersService } from "@/services/domain/customersService";
import type { CustomerWriteInput } from "@/services/repositories/customersRepository";

const customersService = createCustomersService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const result = await customersService.getById(id);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ customer: result.data });
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

  const result = await customersService.update(id, body as CustomerWriteInput);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

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

  const result = await customersService.remove(id);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ message: "Customer deleted.", id });
}
