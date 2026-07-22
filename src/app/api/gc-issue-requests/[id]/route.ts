/**
 * GC Issue Requests [id] API — Sprint 27 #57
 *
 * GET    /api/gc-issue-requests/[id]  — get a single issue request
 * PATCH  /api/gc-issue-requests/[id]  — update status / triage / assign
 * DELETE /api/gc-issue-requests/[id]  — remove an issue request (manager/owner only)
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import {
  deleteGcIssueRequest,
  getGcIssueRequest,
  updateGcIssueRequest,
} from "@/services/gcIssueRequests";
import type { GcIssuePriority, GcIssueStatus } from "@/features/gc-field-issues/types/gcIssueRequest";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "gc_issue_requests", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const issue = await getGcIssueRequest(id);
    if (!issue) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Issue request not found.", code: 404 },
        { status: 404 },
      );
    }
    return NextResponse.json({ issue });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "gc_issue_requests", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title).trim();
    if (body.description !== undefined) patch.description = String(body.description).trim();
    if (body.priority !== undefined) patch.priority = body.priority as GcIssuePriority;
    if (body.status !== undefined) patch.status = body.status as GcIssueStatus;
    if ("assignedTo" in body) patch.assignedTo = body.assignedTo as string | null;
    if ("propertyId" in body) patch.propertyId = body.propertyId as string | null;
    if ("jobId" in body) patch.jobId = body.jobId as string | null;

    const issue = await updateGcIssueRequest(id, patch);
    return NextResponse.json({ issue });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "gc_issue_requests", "delete");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    await deleteGcIssueRequest(id);
    return NextResponse.json({ message: "Issue request deleted." });
  } catch (error) {
    return mapRouteError(error);
  }
}
