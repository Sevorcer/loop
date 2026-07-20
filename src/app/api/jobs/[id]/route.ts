import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import {
  addJobNote,
  deleteJob,
  fetchJobById,
  listJobsWithActivity,
  updateJob,
  updateJobStatus,
} from "@/services/jobs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const job = await fetchJobById(id);

    if (!job) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Job '${id}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    const { activity } = await listJobsWithActivity();
    return NextResponse.json({
      job,
      activity: activity.filter((entry) => entry.jobId === id),
    });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "update");
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
    const job =
      action === "status"
        ? await updateJobStatus(
            id,
            String(body.status ?? "Scheduled") as
              | "Scheduled"
              | "In Progress"
              | "On Hold"
              | "Completed"
              | "Cancelled",
          )
        : action === "note"
          ? await addJobNote(id, String(body.note ?? ""))
          : await updateJob(id, {
              estimateId:
                body.estimateId === undefined ? undefined : String(body.estimateId),
              equipmentBundleId:
                body.equipmentBundleId === undefined
                  ? undefined
                  : String(body.equipmentBundleId),
              title: String(body.title ?? ""),
              customerName: String(body.customerName ?? ""),
              propertyName: String(body.propertyName ?? ""),
              assignedTo: String(body.assignedTo ?? ""),
              scheduledFor: String(body.scheduledFor ?? ""),
              type: String(body.type ?? "Service") as
                | "Install"
                | "Service"
                | "Maintenance"
                | "Inspection",
              priority: String(body.priority ?? "Medium") as
                | "Low"
                | "Medium"
                | "High",
              location: String(body.location ?? ""),
              summary: String(body.summary ?? ""),
              notes: String(body.notes ?? ""),
            });

    if (!job) {
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

    return NextResponse.json({ message: "Job updated.", job });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "delete");
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
    return mapRouteError(error);
  }
}
