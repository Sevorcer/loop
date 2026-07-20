import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { mockJobs } from "@/features/jobs/data/mockJobs";

export async function GET(request: Request) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  return NextResponse.json({ jobs: mockJobs });
}

export async function POST(request: Request) {
  const guard = requirePermission(request, "jobs", "insert");
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
    resource: "jobs",
    details: { title: body.title, type: body.type },
  });

  // TODO: persist to Supabase when wired
  return NextResponse.json({ message: "Job created.", job: body }, { status: 201 });
}
