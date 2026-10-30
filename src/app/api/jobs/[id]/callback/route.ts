import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { parseOptionalTimestamp } from "@/lib/api/parseRequestFields";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emitAuditEvent } from "@/lib/audit";
import { createCallbackFromJob } from "@/services/jobCallbacks";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_callbacks", "insert");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);
    const supabase = await createSupabaseServerClient();
    const job = await createCallbackFromJob(
      id,
      {
        reason: String(body.reason ?? ""),
        scheduledStartAt: parseOptionalTimestamp(body.scheduledStartAt),
      },
      { actorId: guard.ctx.userId, role: guard.ctx.role },
      {
        userId: guard.ctx.userId,
        supabase,
        route: "/api/jobs/[id]/callback",
      },
    );

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "jobs",
      resourceId: job.id,
      details: { type: job.type, callbackOf: id },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return invalidJsonResponse();
    return mapRouteError(error);
  }
}
