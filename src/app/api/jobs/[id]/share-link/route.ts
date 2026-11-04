/**
 * Job Share Link API — GC Portal Task 1
 *
 * POST   /api/jobs/[id]/share-link  — create a new share link (revokes existing)
 * DELETE /api/jobs/[id]/share-link  — revoke the active share link
 * GET    /api/jobs/[id]/share-link  — get the active share link metadata
 *
 * Access: office+ roles (owner, manager, dispatch, office)
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import {
  createJobShareLink,
  getActiveShareLink,
  revokeJobShareLink,
} from "@/services/jobShareLinks";

const OFFICE_PLUS = new Set(["owner", "manager", "dispatch", "office"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  if (!OFFICE_PLUS.has(guard.ctx.role)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Only office+ roles can manage share links.", code: 403 },
      { status: 403 },
    );
  }

  const { id: jobId } = await params;

  try {
    const result = await createJobShareLink(jobId, guard.ctx.userId);
    return NextResponse.json(
      { shareLink: result.link, token: result.token },
      { status: 201 },
    );
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  if (!OFFICE_PLUS.has(guard.ctx.role)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Only office+ roles can manage share links.", code: 403 },
      { status: 403 },
    );
  }

  const { id: jobId } = await params;

  try {
    await revokeJobShareLink(jobId);
    return NextResponse.json({ success: true });
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

  if (!OFFICE_PLUS.has(guard.ctx.role)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Only office+ roles can view share links.", code: 403 },
      { status: 403 },
    );
  }

  const { id: jobId } = await params;

  try {
    const link = await getActiveShareLink(jobId);
    return NextResponse.json({ shareLink: link });
  } catch (error) {
    return mapRouteError(error);
  }
}
