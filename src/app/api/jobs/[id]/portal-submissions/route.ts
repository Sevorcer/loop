/**
 * Portal Submissions API — GC Portal Task 4 (office-facing)
 *
 * GET /api/jobs/[id]/portal-submissions — list submissions for a job
 *
 * Access: all internal staff with job select permission
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getRepositoryContext } from "@/repositories/supabaseContext";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  const { id: jobId } = await params;

  try {
    const ctx = await getRepositoryContext({ userId: guard.ctx.userId });
    const { data, error } = await ctx.supabase
      .from("portal_submissions")
      .select("id, name, contact, message, created_at")
      .eq("job_id", jobId)
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      throw Object.assign(new Error(error.message), { status: 500 });
    }

    const submissions = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      contact: row.contact,
      message: row.message,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ submissions });
  } catch (error) {
    return mapRouteError(error);
  }
}
