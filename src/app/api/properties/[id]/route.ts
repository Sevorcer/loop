import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { createRepositoryErrorBody } from "@/lib/repositories/http";
import { createPropertiesService } from "@/services/domain/propertiesService";
import type { PropertyWriteInput } from "@/services/repositories/propertiesRepository";

const propertiesService = createPropertiesService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const result = await propertiesService.getById(id);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ property: result.data });
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

  const result = await propertiesService.update(id, body as PropertyWriteInput);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

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

  const result = await propertiesService.remove(id);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ message: "Property deleted.", id });
}
