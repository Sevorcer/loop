import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { mockJobs } from "@/features/jobs/data/mockJobs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const job = mockJobs.find((j) => j.id === id);

  if (!job) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: `Job '${id}' not found.`, code: 404 },
      { status: 404 },
    );
  }

  return NextResponse.json({ job });
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

  // TODO: persist to Supabase when wired
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

  // TODO: persist to Supabase when wired
  return NextResponse.json({ message: "Job deleted.", id });
}
