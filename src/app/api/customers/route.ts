import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { mockCustomers } from "@/features/customers/data/mockCustomers";

export async function GET(request: Request) {
  const guard = requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  return NextResponse.json({ customers: mockCustomers });
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

  // TODO: persist to Supabase when wired
  return NextResponse.json({ message: "Customer created.", customer: body }, { status: 201 });
}
