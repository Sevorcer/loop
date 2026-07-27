import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getJobCompletionChecklist } from "@/services/jobs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const checklist = await getJobCompletionChecklist(id, guard.ctx.role);
    return NextResponse.json({ checklist });
  } catch (error) {
    return mapRouteError(error);
  }
}
