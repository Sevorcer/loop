import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  getPostRequestTrace,
} from "@/lib/api/postFailureTelemetry";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emitAuditEvent } from "@/lib/audit";
import { logWriteFailure } from "@/lib/observability/writes";
import { createJob, listJobsWithActivity } from "@/services/jobs";

const JOB_TYPES = new Set(["Install", "Service", "Maintenance", "Inspection"]);
const JOB_PRIORITIES = new Set(["Low", "Medium", "High"]);
const JOB_APPOINTMENT_WINDOWS = new Set(["Morning", "Afternoon"]);

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

function readJobAppointmentWindow(value: unknown) {
  if (value == null || value === "") {
    return undefined;
  }
  const normalized = String(value);
  if (!JOB_APPOINTMENT_WINDOWS.has(normalized)) {
    throw new Error("Invalid appointment window.");
  }
  return normalized as "Morning" | "Afternoon";
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { jobs, activity } = await listJobsWithActivity();
    return NextResponse.json({ jobs, activity });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const route = "/api/jobs";
  const operation = "create_job";
  let requestId: string | undefined;

  try {
    requestId = getPostRequestTrace(request, "jobs-post").requestId;
    let body: Record<string, unknown> = {};

    const guard = await requirePermission(request, "jobs", "insert");
    if (!guard.ok) return guard.response;
    const { userId } = guard.ctx;

    body = await readJsonObject(request);

    const payload = {
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
      appointmentWindow: readJobAppointmentWindow(body.appointmentWindow),
      type: readJobType(body.type),
      priority: readJobPriority(body.priority),
      location: String(body.location ?? "").trim(),
      summary: String(body.summary ?? "").trim(),
      notes: String(body.notes ?? "").trim(),
    };

    const supabase = await createSupabaseServerClient();

    const job = await createJob(payload, {
      userId,
      supabase,
      route,
      requestId,
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
    const tracedRequestId = requestId ?? getPostRequestTrace(request, "jobs-post").requestId;

    logWriteFailure({ route, operation, requestId: tracedRequestId }, error);

    if (error instanceof SyntaxError) {
      return invalidJsonResponse();
    }

    return mapRouteError(error);
  }
}
