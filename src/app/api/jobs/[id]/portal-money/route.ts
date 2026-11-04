/**
 * Portal Money Toggle API — GC Portal Task 3
 *
 * PATCH /api/jobs/[id]/portal-money — toggle portal_money_visible flag
 * GET   /api/jobs/[id]/portal-money — read current toggle state
 *
 * Body (PATCH): { visible: boolean }
 * Access: office+ roles (owner, manager, dispatch, office)
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject, invalidJsonResponse } from "@/lib/api/routeErrors";
import { getRepositoryContext } from "@/repositories/supabaseContext";

const OFFICE_PLUS = new Set(["owner", "manager", "dispatch", "office"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  if (!OFFICE_PLUS.has(guard.ctx.role)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Only office+ roles can toggle portal money visibility.", code: 403 },
      { status: 403 },
    );
  }

  const { id: jobId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const visible = body.visible;
  if (typeof visible !== "boolean") {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", message: "'visible' must be a boolean.", code: 400 },
      { status: 400 },
    );
  }

  try {
    const ctx = await getRepositoryContext({ userId: guard.ctx.userId });
    const { error } = await ctx.supabase
      .from("jobs")
      .update({ portal_money_visible: visible })
      .eq("id", jobId)
      .eq("org_id", ctx.orgId);

    if (error) {
      throw Object.assign(new Error(error.message), { status: 500 });
    }

    return NextResponse.json({ success: true, portalMoneyVisible: visible });
  } catch (error) {
    return mapRouteError(error);
  }
}

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
      .from("jobs")
      .select("portal_money_visible")
      .eq("id", jobId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (error) {
      throw Object.assign(new Error(error.message), { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Job not found.", code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({
      portalMoneyVisible: (data as Record<string, unknown>).portal_money_visible as boolean,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
