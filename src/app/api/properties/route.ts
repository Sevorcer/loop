import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { createRepositoryErrorBody } from "@/lib/repositories/http";
import { createPropertiesService } from "@/services/domain/propertiesService";
import type { PropertyWriteInput } from "@/services/repositories/propertiesRepository";

const propertiesService = createPropertiesService();

export async function GET(request: Request) {
  const guard = requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  const result = await propertiesService.list();
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ properties: result.data.items });
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

  const result = await propertiesService.create(body as PropertyWriteInput);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ message: "Property created.", property: result.data }, { status: 201 });
}
