import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  getPostRequestTrace,
} from "@/lib/api/postFailureTelemetry";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { parseOptionalTimestamp } from "@/lib/api/parseRequestFields";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emitAuditEvent } from "@/lib/audit";
import { logWriteFailure } from "@/lib/observability/writes";
import { createJob, listJobsWithActivity, listJobsPage } from "@/services/jobs";

import type { JobAppointmentHour, JobCloseoutMode, JobPriority, JobStatus, JobType } from "@/features/jobs/types/job";

const JOB_TYPES = new Set(["Install", "Service", "Maintenance", "Inspection", "Estimate", "Callback"]);
const JOB_PRIORITIES = new Set(["Low", "Medium", "High"]);
const JOB_CLOSEOUT_MODES = new Set(["full", "visit"]);

function readJobType(value: unknown) {
  const normalized = String(value ?? "Service");
  if (!JOB_TYPES.has(normalized)) {
    throw new Error("Invalid job type.");
  }
  return normalized as "Install" | "Service" | "Maintenance" | "Inspection" | "Estimate" | "Callback";
}

function readJobPriority(value: unknown) {
  const normalized = String(value ?? "Medium");
  if (!JOB_PRIORITIES.has(normalized)) {
    throw new Error("Invalid job priority.");
  }
  return normalized as "Low" | "Medium" | "High";
}

function readCloseoutMode(value: unknown): JobCloseoutMode | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const normalized = String(value);
  if (!JOB_CLOSEOUT_MODES.has(normalized)) {
    throw new Error("Invalid closeout mode.");
  }
  return normalized as JobCloseoutMode;
}

function readJobAppointmentHour(value: unknown): JobAppointmentHour | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 12) {
    throw new Error("Invalid appointment hour. Must be an integer between 1 and 12.");
  }
  return num as JobAppointmentHour;
}

const VALID_STATUSES = new Set<JobStatus>(["Scheduled", "In Progress", "On Hold", "Completed", "Cancelled"]);
const VALID_TYPES_SET = new Set<JobType>(["Install", "Service", "Maintenance", "Inspection", "Estimate", "Callback"]);
const VALID_PRIORITIES = new Set<JobPriority>(["Low", "Medium", "High"]);

function parseMultiParam<T extends string>(value: string | null, allowed: Set<T>): T[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter((v): v is T => allowed.has(v as T));
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const paginated = url.searchParams.has("page");

    // When the `page` query param is present, use server-side filtering +
    // pagination so only the rows the client renders are transferred.
    // Without it, the legacy behavior (full workspace + activity) is
    // preserved for consumers that depend on it (Daily Plans, Calendar
    // layout, Copilot).
    if (paginated) {
      const statuses = parseMultiParam(url.searchParams.get("status"), VALID_STATUSES);
      const types = parseMultiParam(url.searchParams.get("type"), VALID_TYPES_SET);
      const priorities = parseMultiParam(url.searchParams.get("priority"), VALID_PRIORITIES);
      const search = url.searchParams.get("search") ?? undefined;
      const assignee = url.searchParams.get("assignee") ?? undefined;
      const sort = url.searchParams.get("sort") ?? undefined;
      const order = url.searchParams.get("order") === "asc" ? "asc" as const : "desc" as const;
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const pageSize = Math.max(1, Math.min(Number(url.searchParams.get("pageSize")) || 50, 200));

      const result = await listJobsPage({
        status: statuses.length > 0 ? statuses : undefined,
        type: types.length > 0 ? types : undefined,
        priority: priorities.length > 0 ? priorities : undefined,
        search,
        assignee,
        sort,
        order,
        page,
        pageSize,
      });

      return NextResponse.json(result);
    }

    // Legacy: return the full workspace + activity for other consumers.
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
      assignedTo: String(body.assignedTo ?? "").trim(), assigneeIds: Array.isArray(body.assigneeIds) ? body.assigneeIds.map((value) => String(value)) : undefined,
      scheduledFor: body.scheduledFor === null ? null : body.scheduledFor !== undefined ? String(body.scheduledFor).trim() || null : undefined,
      appointmentHour: readJobAppointmentHour(body.appointmentHour),
      // PR3C clock-time fields
      scheduledStartAt: parseOptionalTimestamp(body.scheduledStartAt),
      scheduledEndAt: parseOptionalTimestamp(body.scheduledEndAt),
      arrivalWindowStartAt: parseOptionalTimestamp(body.arrivalWindowStartAt),
      arrivalWindowEndAt: parseOptionalTimestamp(body.arrivalWindowEndAt),
      type: readJobType(body.type),
      priority: readJobPriority(body.priority),
      closeoutMode: readCloseoutMode(body.closeoutMode),
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
