import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { createRepositoryErrorBody } from "@/lib/repositories/http";
import { createCustomersService } from "@/services/domain/customersService";
import type { CustomerWriteInput } from "@/services/repositories/customersRepository";

const customersService = createCustomersService();

export async function GET(request: Request) {
  const guard = requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  const result = await customersService.list();
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ customers: result.data.items });
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

  emitAuditEvent({
    role: guard.ctx.role,
    action: "create",
    resource: "customers",
    details: { name: body.name },
  });

  const result = await customersService.create(body as CustomerWriteInput);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ message: "Customer created.", customer: result.data }, { status: 201 });
}
