import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  extractSanitizedPostPayload,
  extractSupabaseError,
  getPostRequestTrace,
} from "@/lib/api/postFailureTelemetry";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { createJob, listJobsWithActivity } from "@/services/jobs";

const JOB_TYPES = new Set(["Install", "Service", "Maintenance", "Inspection"]);
const JOB_PRIORITIES = new Set(["Low", "Medium", "High"]);

function readJobType(value: unknown) {
  const normalized = String(value ?? "Service");
  if (!JOB_TYPES.has(normalized)) {
    throw new Error("Invalid job type.");
  }
  return normalized as "Install" | "Service" | "Maintenance" | "Inspection";
}

function readJobPriority(value: unknown) {
  const normalized = String(value ?? "Medium");
  if (!JOB_PRIORITIES.has(normalized)) {
    throw new Error("Invalid job priority.");
  }
  return normalized as "Low" | "Medium" | "High";
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  console.log(
    "[AUTH_FLOW]",
    JSON.stringify({
      event: "guard.pass",
      route: "/api/jobs",
      userId: guard.ctx.userId,
      role: guard.ctx.role,
      requestId:
        request.headers.get("x-request-id") ??
        request.headers.get("x-correlation-id") ??
        request.headers.get("x-vercel-id") ??
        undefined,
    }),
  );

  try {
    const { jobs, activity } = await listJobsWithActivity();
    return NextResponse.json({ jobs, activity });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const { requestId, correlationId } = getPostRequestTrace(request, "jobs-post");
  let step = "permission_guard";

  const guard = await requirePermission(request, "jobs", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    step = "body_parse";
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    step = "create_job_service";
    const job = await createJob({
      estimateId: body.estimateId !== undefined ? String(body.estimateId).trim() : undefined,
      equipmentBundleId:
        body.equipmentBundleId !== undefined
          ? String(body.equipmentBundleId).trim()
          : undefined,
      title: String(body.title ?? "").trim(),
      customerName: String(body.customerName ?? "").trim(),
      propertyName: String(body.propertyName ?? "").trim(),
      assignedTo: String(body.assignedTo ?? "").trim(),
      scheduledFor: String(body.scheduledFor ?? "").trim(),
      type: readJobType(body.type),
      priority: readJobPriority(body.priority),
      location: String(body.location ?? "").trim(),
      summary: String(body.summary ?? "").trim(),
      notes: String(body.notes ?? "").trim(),
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "jobs",
      resourceId: job.id,
      details: { title: job.title, type: job.type },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    const isError = error instanceof Error;
    const sanitizedPayload = extractSanitizedPostPayload(body);
    const supabaseError = extractSupabaseError(error);

    console.error("api.jobs.post.failure", {
      event: "api.jobs.post.failure",
      route: "/api/jobs",
      method: "POST",
      requestId,
      correlationId,
      step,
      error: {
        name: isError ? error.name : typeof error,
        message: isError ? error.message : String(error),
        stack: isError ? (error.stack ?? null) : null,
      },
      supabaseError,
      sanitizedPayload: {
        ...sanitizedPayload,
        requiredFieldPresence: {
          hasTitle: Boolean(body.title),
          hasCustomerName: Boolean(body.customerName),
          hasPropertyName: Boolean(body.propertyName),
          hasAssignedTo: Boolean(body.assignedTo),
          hasScheduledFor: Boolean(body.scheduledFor),
          hasType: body.type !== undefined && body.type !== null,
          hasPriority: body.priority !== undefined && body.priority !== null,
        },
      },
    });
    return mapRouteError(error);
  }
}
