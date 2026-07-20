import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import {
  createJobActivity,
  deleteJob,
  getJob,
  listJobActivity,
  updateJob,
} from "@/services/jobs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let job = null;
  try {
    job = await getJob(id);
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to load job.",
        code: 500,
      },
      { status: 500 }
    );
  }

  if (!job) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: `Job '${id}' not found.`, code: 404 },
      { status: 404 },
    );
  }

  try {
    const activity = await listJobActivity(id);
    return NextResponse.json({ job, activity });
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to load job activity.",
        code: 500,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", message: "Request body must be valid JSON.", code: 400 },
      { status: 400 },
    );
  }

  try {
    const updated = await updateJob(id, {
      estimateId:
        body.estimateId !== undefined ? String(body.estimateId).trim() : undefined,
      equipmentBundleId:
        body.equipmentBundleId !== undefined
          ? String(body.equipmentBundleId).trim()
          : undefined,
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      customerName:
        body.customerName !== undefined
          ? String(body.customerName).trim()
          : undefined,
      propertyName:
        body.propertyName !== undefined
          ? String(body.propertyName).trim()
          : undefined,
      assignedTo:
        body.assignedTo !== undefined ? String(body.assignedTo).trim() : undefined,
      scheduledFor:
        body.scheduledFor !== undefined ? String(body.scheduledFor).trim() : undefined,
      type:
        body.type as "Install" | "Service" | "Maintenance" | "Inspection" | undefined,
      priority: body.priority as "Low" | "Medium" | "High" | undefined,
      location:
        body.location !== undefined ? String(body.location).trim() : undefined,
      summary: body.summary !== undefined ? String(body.summary).trim() : undefined,
      notes: body.notes !== undefined ? String(body.notes).trim() : undefined,
      status:
        body.status as
          | "Scheduled"
          | "In Progress"
          | "On Hold"
          | "Completed"
          | "Cancelled"
          | undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Job '${id}' not found.`, code: 404 },
        { status: 404 }
      );
    }

    if (body.activity && typeof body.activity === "object") {
      const activity = body.activity as {
        type?: string;
        title?: string;
        description?: string;
      };

      if (activity.type && activity.title && activity.description) {
        await createJobActivity(id, {
          type: activity.type as
            | "created"
            | "edited"
            | "scheduled"
            | "assigned"
            | "status"
            | "note",
          title: activity.title,
          description: activity.description,
        });
      }
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "jobs",
      resourceId: id,
      details: body,
    });

    return NextResponse.json({ job: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to update job.",
        code: 500,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "delete");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const deleted = await deleteJob(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Job '${id}' not found.`, code: 404 },
        { status: 404 }
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
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to delete job.",
        code: 500,
      },
      { status: 500 }
    );
  }
}
