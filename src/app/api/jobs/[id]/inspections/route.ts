import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  createApiErrorResponse,
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import {
  canEditInspections,
  createJobInspection,
  isInspectionBookedBy,
  isInspectionResult,
  isInspectionType,
  listJobInspections,
  updateJobInspection,
} from "@/services/jobInspections";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_inspections", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const inspections = await listJobInspections(id);
    return NextResponse.json({ inspections });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_inspections", "insert");
  if (!guard.ok) return guard.response;
  if (!canEditInspections(guard.ctx.role)) {
    return createApiErrorResponse(
      "FORBIDDEN",
      "Only office staff and above can create inspections.",
      403,
    );
  }

  try {
    const { id } = await params;
    const body = await readJsonObject(request);

    const inspectionType = String(body.inspectionType ?? "other");
    if (!isInspectionType(inspectionType)) {
      return createApiErrorResponse("VALIDATION_ERROR", `Invalid inspection type: ${inspectionType}`, 400);
    }

    const bookedBy = String(body.bookedBy ?? "office");
    if (!isInspectionBookedBy(bookedBy)) {
      return createApiErrorResponse("VALIDATION_ERROR", `Invalid booked_by: ${bookedBy}`, 400);
    }

    const inspection = await createJobInspection({
      jobId: id,
      permitId: typeof body.permitId === "string" ? body.permitId : null,
      inspectionType,
      scheduledDate: typeof body.scheduledDate === "string" ? body.scheduledDate : null,
      scheduledWindow: typeof body.scheduledWindow === "string" ? body.scheduledWindow : null,
      bookedBy,
      inspectorName: typeof body.inspectorName === "string" ? body.inspectorName : null,
      result: typeof body.result === "string" && isInspectionResult(body.result) ? body.result : undefined,
      resultDate: typeof body.resultDate === "string" ? body.resultDate : null,
      rescheduledDate: typeof body.rescheduledDate === "string" ? body.rescheduledDate : null,
      parentInspectionId: typeof body.parentInspectionId === "string" ? body.parentInspectionId : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    return NextResponse.json({ inspection }, { status: 201 });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "Invalid JSON body.")
    ) {
      return invalidJsonResponse();
    }
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_inspections", "update");
  if (!guard.ok) return guard.response;
  if (!canEditInspections(guard.ctx.role)) {
    return createApiErrorResponse(
      "FORBIDDEN",
      "Only office staff and above can update inspections.",
      403,
    );
  }

  try {
    void (await params);
    const body = await readJsonObject(request);
    const inspectionId = String(body.inspectionId ?? "").trim();

    if (!inspectionId) {
      return NextResponse.json({ error: "inspectionId is required." }, { status: 400 });
    }

    const inspection = await updateJobInspection(inspectionId, {
      permitId: body.permitId !== undefined
        ? (typeof body.permitId === "string" ? body.permitId : null)
        : undefined,
      inspectionType: typeof body.inspectionType === "string" && isInspectionType(body.inspectionType)
        ? body.inspectionType
        : undefined,
      scheduledDate: body.scheduledDate !== undefined
        ? (typeof body.scheduledDate === "string" ? body.scheduledDate : null)
        : undefined,
      scheduledWindow: typeof body.scheduledWindow === "string"
        ? body.scheduledWindow
        : undefined,
      bookedBy: typeof body.bookedBy === "string" && isInspectionBookedBy(body.bookedBy)
        ? body.bookedBy
        : undefined,
      inspectorName: body.inspectorName !== undefined
        ? (typeof body.inspectorName === "string" ? body.inspectorName : null)
        : undefined,
      result: typeof body.result === "string" && isInspectionResult(body.result)
        ? body.result
        : undefined,
      resultDate: body.resultDate !== undefined
        ? (typeof body.resultDate === "string" ? body.resultDate : null)
        : undefined,
      rescheduledDate: body.rescheduledDate !== undefined
        ? (typeof body.rescheduledDate === "string" ? body.rescheduledDate : null)
        : undefined,
      parentInspectionId: body.parentInspectionId !== undefined
        ? (typeof body.parentInspectionId === "string" ? body.parentInspectionId : null)
        : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    return NextResponse.json({ inspection });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "Invalid JSON body.")
    ) {
      return invalidJsonResponse();
    }
    return mapRouteError(error);
  }
}
