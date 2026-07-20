import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { mockProperties } from "@/features/properties/data/mockProperties";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const property = mockProperties.find((p) => p.id === id);

  if (!property) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: `Property '${id}' not found.`, code: 404 },
      { status: 404 },
    );
  }

  return NextResponse.json({ property });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "update");
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
    resource: "properties",
    resourceId: id,
    details: body,
  });

  // TODO: persist to Supabase when wired
  return NextResponse.json({ message: "Property updated.", id });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "delete");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  emitAuditEvent({
    role: guard.ctx.role,
    action: "delete",
    resource: "properties",
    resourceId: id,
  });

  // TODO: persist to Supabase when wired
  return NextResponse.json({ message: "Property deleted.", id });
}
