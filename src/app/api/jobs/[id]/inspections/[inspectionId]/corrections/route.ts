import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  createApiErrorResponse,
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import {
  addCorrection,
  canEditInspections,
  listInspectionCorrections,
  removeCorrection,
  toggleCorrectionComplete,
} from "@/services/jobInspections";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; inspectionId: string }> },
) {
  const guard = await requirePermission(request, "job_inspections", "select");
  if (!guard.ok) return guard.response;

  try {
    const { inspectionId } = await params;
    const corrections = await listInspectionCorrections(inspectionId);
    return NextResponse.json({ corrections });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; inspectionId: string }> },
) {
  const guard = await requirePermission(request, "job_inspections", "insert");
  if (!guard.ok) return guard.response;
  if (!canEditInspections(guard.ctx.role)) {
    return createApiErrorResponse(
      "FORBIDDEN",
      "Only office staff and above can add corrections.",
      403,
    );
  }

  try {
    const { inspectionId } = await params;
    const body = await readJsonObject(request);
    const description = String(body.description ?? "").trim();

    if (!description) {
      return createApiErrorResponse("VALIDATION_ERROR", "Correction description is required.", 400);
    }

    const correction = await addCorrection(inspectionId, description);
    return NextResponse.json({ correction }, { status: 201 });
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
  { params }: { params: Promise<{ id: string; inspectionId: string }> },
) {
  const guard = await requirePermission(request, "job_inspections", "update");
  if (!guard.ok) return guard.response;

  try {
    void (await params);
    const body = await readJsonObject(request);
    const correctionId = String(body.correctionId ?? "").trim();

    if (!correctionId) {
      return NextResponse.json({ error: "correctionId is required." }, { status: 400 });
    }

    const correction = await toggleCorrectionComplete(
      correctionId,
      body.isComplete === true,
    );
    return NextResponse.json({ correction });
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; inspectionId: string }> },
) {
  const guard = await requirePermission(request, "job_inspections", "update");
  if (!guard.ok) return guard.response;
  if (!canEditInspections(guard.ctx.role)) {
    return createApiErrorResponse(
      "FORBIDDEN",
      "Only office staff and above can remove corrections.",
      403,
    );
  }

  try {
    void (await params);
    const body = await readJsonObject(request);
    const correctionId = String(body.correctionId ?? "").trim();

    if (!correctionId) {
      return NextResponse.json({ error: "correctionId is required." }, { status: 400 });
    }

    await removeCorrection(correctionId);
    return NextResponse.json({ ok: true });
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
