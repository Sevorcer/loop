/**
 * Portal Submissions API — GC Portal Task 4 (office-facing) + Triage Queue
 *
 * GET  /api/jobs/[id]/portal-submissions — list submissions for a job
 * PATCH /api/jobs/[id]/portal-submissions — update a submission's triage status
 *
 * Access: all internal staff with job select/update permission
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { getRepositoryContext } from "@/repositories/supabaseContext";

const VALID_STATUSES = ["unreviewed", "accepted", "dismissed"] as const;

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
      .select("id, name, submitter_company, contact, message, status, created_at")
      .eq("job_id", jobId)
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      // If columns don't exist yet (migration not applied), fall back to
      // the original select without the new columns.
      if (error.message?.includes("submitter_company") || error.message?.includes("status")) {
        const { data: fallbackData, error: fallbackError } = await ctx.supabase
          .from("portal_submissions")
          .select("id, name, contact, message, created_at")
          .eq("job_id", jobId)
          .eq("org_id", ctx.orgId)
          .order("created_at", { ascending: false });

        if (fallbackError) {
          throw Object.assign(new Error(fallbackError.message), { status: 500 });
        }

        const submissions = (fallbackData ?? []).map((row: Record<string, unknown>) => ({
          id: row.id,
          name: row.name,
          company: "",
          contact: row.contact,
          message: row.message,
          status: "unreviewed",
          createdAt: row.created_at,
        }));

        return NextResponse.json({ submissions });
      }
      throw Object.assign(new Error(error.message), { status: 500 });
    }

    const submissions = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      company: row.submitter_company ?? "",
      contact: row.contact,
      message: row.message,
      status: row.status ?? "unreviewed",
      createdAt: row.created_at,
    }));

    return NextResponse.json({ submissions });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  const { id: jobId } = await params;

  try {
    const body = await readJsonObject(request);
    const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
    const status = typeof body.status === "string" ? body.status : "";

    if (!submissionId) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "submissionId is required.", code: 400 },
        { status: 400 },
      );
    }

    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: `status must be one of: ${VALID_STATUSES.join(", ")}`, code: 400 },
        { status: 400 },
      );
    }

    const ctx = await getRepositoryContext({ userId: guard.ctx.userId });
    const { error } = await ctx.supabase
      .from("portal_submissions")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: guard.ctx.userId ?? null,
      } as never)
      .eq("id", submissionId)
      .eq("job_id", jobId)
      .eq("org_id", ctx.orgId);

    if (error) {
      throw Object.assign(new Error(error.message), { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
