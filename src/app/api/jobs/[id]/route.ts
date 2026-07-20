import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { createRepositoryErrorBody } from "@/lib/repositories/http";
import { createJobsService } from "@/services/domain/jobsService";
import type { JobWriteInput } from "@/services/repositories/jobsRepository";

const jobsService = createJobsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const result = await jobsService.getById(id);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ job: result.data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "update");
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
    resource: "jobs",
    resourceId: id,
    details: body,
  });

  const result = await jobsService.update(id, body as JobWriteInput);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ message: "Job updated.", id });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "delete");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  emitAuditEvent({
    role: guard.ctx.role,
    action: "delete",
    resource: "jobs",
    resourceId: id,
  });

  const result = await jobsService.remove(id);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ message: "Job deleted.", id });
}
