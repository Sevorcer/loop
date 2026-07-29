/**
 * GC Issue Requests API — Sprint 27 #57
 *
 * GET  /api/gc-issue-requests         — list issue requests (dispatch/admin queue)
 * POST /api/gc-issue-requests         — submit a new issue request
 *
 * Access:
 *   GET:  owner, manager, dispatch, office, sales (all staff can view queue)
 *   POST: owner, manager, dispatch, tech, office, sales (any field staff can submit)
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { logWriteFailure } from "@/lib/observability/writes";
import {
  createGcIssueRequest,
  listGcIssueRequests,
} from "@/services/gcIssueRequests";
import type { GcIssuePriority, GcIssueStatus } from "@/features/gc-field-issues/types/gcIssueRequest";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "gc_issue_requests", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as GcIssueStatus | null;
  const priority = url.searchParams.get("priority") as GcIssuePriority | null;
  const jobId = url.searchParams.get("jobId") ?? undefined;
  const propertyId = url.searchParams.get("propertyId") ?? undefined;

  try {
    const issues = await listGcIssueRequests({
      status: status ?? undefined,
      priority: priority ?? undefined,
      jobId,
      propertyId,
    });
    return NextResponse.json({ issues });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "gc_issue_requests", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const issue = await createGcIssueRequest(
      {
        title: String(body.title ?? "").trim(),
        description: String(body.description ?? "").trim(),
        priority: (body.priority ?? "medium") as GcIssuePriority,
        propertyId: body.propertyId ? String(body.propertyId) : undefined,
        jobId: body.jobId ? String(body.jobId) : undefined,
        attachmentIds: Array.isArray(body.attachmentIds)
          ? (body.attachmentIds as string[])
          : undefined,
      },
    );
    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    logWriteFailure({ route: "/api/gc-issue-requests", request }, error);
    return mapRouteError(error);
  }
}
