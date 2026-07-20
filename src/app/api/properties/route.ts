import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { mockProperties } from "@/features/properties/data/mockProperties";

export async function GET(request: Request) {
  const guard = requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  return NextResponse.json({ properties: mockProperties });
}

export async function POST(request: Request) {
  const guard = requirePermission(request, "properties", "insert");
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
    resource: "properties",
    details: { address: body.address },
  });

  // TODO: persist to Supabase when wired
  return NextResponse.json({ message: "Property created.", property: body }, { status: 201 });
}
