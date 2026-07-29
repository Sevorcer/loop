import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { parseOptionalTimestamp } from "@/lib/api/parseRequestFields";
import { emitAuditEvent } from "@/lib/audit";
import { logWriteFailure } from "@/lib/observability/writes";
import {
  addJobNote,
  deleteJob,
  getJob,
  listJobActivity,
  updateJob,
  updateJobStatus,
  updateRequiredQaChecklist,
  setJobNotes,
} from "@/services/jobs";
import { normalizeQaChecklist } from "@/features/jobs/utils/jobCompletionChecklist";

import type { JobAppointmentHour } from "@/features/jobs/types/job";

const JOB_ACTIONS = new Set(["update", "status", "note", "notes", "qa"]);
const JOB_TYPES = new Set(["Install", "Service", "Maintenance", "Inspection"]);
const JOB_PRIORITIES = new Set(["Low", "Medium", "High"]);
const JOB_STATUSES = new Set([
  "Scheduled",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
]);

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

function readJobStatus(value: unknown) {
  const normalized = String(value ?? "Scheduled");
  if (!JOB_STATUSES.has(normalized)) {
    throw new Error("Invalid job status.");
  }
  return normalized as
    | "Scheduled"
    | "In Progress"
    | "On Hold"
    | "Completed"
    | "Cancelled";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const job = await getJob(id);

    if (!job) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Job '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    const activity = await listJobActivity(id);
    return NextResponse.json({ job, activity });
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

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const { id } = await params;
    const action = String(body.action ?? "update");

    if (!JOB_ACTIONS.has(action)) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid job action.",
          code: 400,
        },
        { status: 400 },
      );
    }

    const result =
      action === "status"
        ? await updateJobStatus(id, readJobStatus(body.status), {
            actorId: guard.ctx.userId,
            role: guard.ctx.role,
          })
        : action === "note"
          ? await addJobNote(id, String(body.note ?? ""), {
              actorId: guard.ctx.userId,
              role: guard.ctx.role,
            })
          : action === "notes"
            ? await setJobNotes(id, String(body.notes ?? ""), {
                actorId: guard.ctx.userId,
                role: guard.ctx.role,
              })
            : action === "qa"
              ? await updateRequiredQaChecklist(
                  id,
                  normalizeQaChecklist(body.checklist),
                  {
                    actorId: guard.ctx.userId,
                    role: guard.ctx.role,
                  },
                )
          : await updateJob(id, {
              estimateId:
                body.estimateId !== undefined ? String(body.estimateId).trim() : undefined,
              equipmentBundleId:
                body.equipmentBundleId !== undefined
                  ? String(body.equipmentBundleId).trim()
                  : undefined,
              title: String(body.title ?? "").trim(),
              customerName: String(body.customerName ?? "").trim(),
              propertyName: String(body.propertyName ?? "").trim(),
              assignedTo: String(body.assignedTo ?? "").trim(),
              scheduledFor: body.scheduledFor !== undefined ? String(body.scheduledFor).trim() : undefined,
              appointmentHour: readJobAppointmentHour(body.appointmentHour),
              // PR3C clock-time fields
              scheduledStartAt: parseOptionalTimestamp(body.scheduledStartAt),
              scheduledEndAt: parseOptionalTimestamp(body.scheduledEndAt),
              arrivalWindowStartAt: parseOptionalTimestamp(body.arrivalWindowStartAt),
              arrivalWindowEndAt: parseOptionalTimestamp(body.arrivalWindowEndAt),
              type: readJobType(body.type),
              priority: readJobPriority(body.priority),
              location: String(body.location ?? "").trim(),
              summary: String(body.summary ?? "").trim(),
              notes: String(body.notes ?? "").trim(),
            });

    if (!result) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Job '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "jobs",
      resourceId: id,
      details: body,
    });

    if (action === "qa") {
      return NextResponse.json({ checklist: result });
    }

    return NextResponse.json({ job: result });
  } catch (error) {
    logWriteFailure({ route: "/api/jobs/[id]", request }, error);
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "delete");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const deleted = await deleteJob(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Job '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "delete",
      resource: "jobs",
      resourceId: id,
    });

    return NextResponse.json({ message: "Job deleted.", id });
  } catch (error) {
    logWriteFailure({ route: "/api/jobs/[id]", request }, error);
    return mapRouteError(error);
  }
}
