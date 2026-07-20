import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { createJob, listJobsWithActivity } from "@/services/jobs";

export async function GET(request: Request) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { jobs, activity } = await listJobsWithActivity();
    return NextResponse.json({ jobs, activity });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = requirePermission(request, "jobs", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const job = await createJob({
      estimateId: body.estimateId === undefined ? undefined : String(body.estimateId),
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
      priority: String(body.priority ?? "Medium") as "Low" | "Medium" | "High",
      location: String(body.location ?? ""),
      summary: String(body.summary ?? ""),
      notes: String(body.notes ?? ""),
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "jobs",
      resourceId: job.id,
      details: { title: job.title, type: job.type },
    });

    return NextResponse.json({ message: "Job created.", job }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
