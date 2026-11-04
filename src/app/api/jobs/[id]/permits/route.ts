import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  createApiErrorResponse,
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import {
  canEditPermits,
  createJobPermit,
  isPermitStatus,
  listJobPermits,
  unvoidJobPermit,
  updateJobPermit,
  voidJobPermit,
} from "@/services/jobPermits";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_permits", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const permits = await listJobPermits(id);
    return NextResponse.json({ permits });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_permits", "insert");
  if (!guard.ok) return guard.response;
  if (!canEditPermits(guard.ctx.role)) {
    return createApiErrorResponse(
      "FORBIDDEN",
      "Only office staff and above can create permits.",
      403,
    );
  }

  try {
    const { id } = await params;
    const body = await readJsonObject(request);

    const permit = await createJobPermit({
      jobId: id,
      jurisdiction: String(body.jurisdiction ?? ""),
      permitType: String(body.permitType ?? ""),
      permitNumber: body.permitNumber != null ? String(body.permitNumber) : null,
      status: typeof body.status === "string" && isPermitStatus(body.status)
        ? body.status
        : undefined,
      appliedAt: typeof body.appliedAt === "string" ? body.appliedAt : null,
      intakeAppointmentAt: typeof body.intakeAppointmentAt === "string"
        ? body.intakeAppointmentAt
        : null,
      issuedAt: typeof body.issuedAt === "string" ? body.issuedAt : null,
      correctionsNotes: typeof body.correctionsNotes === "string"
        ? body.correctionsNotes
        : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    return NextResponse.json({ permit }, { status: 201 });
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
  const guard = await requirePermission(request, "job_permits", "update");
  if (!guard.ok) return guard.response;
  if (!canEditPermits(guard.ctx.role)) {
    return createApiErrorResponse(
      "FORBIDDEN",
      "Only office staff and above can update permits.",
      403,
    );
  }

  try {
    void (await params);
    const body = await readJsonObject(request);
    const permitId = String(body.permitId ?? "").trim();

    if (!permitId) {
      return NextResponse.json({ error: "permitId is required." }, { status: 400 });
    }

    // Void / un-void operations
    if (body.action === "void") {
      const permit = await voidJobPermit(permitId, guard.ctx.userId);
      return NextResponse.json({ permit });
    }

    if (body.action === "unvoid") {
      const permit = await unvoidJobPermit(permitId);
      return NextResponse.json({ permit });
    }

    // Standard field update
    const permit = await updateJobPermit(permitId, {
      jurisdiction: typeof body.jurisdiction === "string" ? body.jurisdiction : undefined,
      permitType: typeof body.permitType === "string" ? body.permitType : undefined,
      permitNumber: body.permitNumber !== undefined
        ? (body.permitNumber != null ? String(body.permitNumber) : null)
        : undefined,
      status: typeof body.status === "string" && isPermitStatus(body.status)
        ? body.status
        : undefined,
      appliedAt: body.appliedAt !== undefined
        ? (typeof body.appliedAt === "string" ? body.appliedAt : null)
        : undefined,
      intakeAppointmentAt: body.intakeAppointmentAt !== undefined
        ? (typeof body.intakeAppointmentAt === "string" ? body.intakeAppointmentAt : null)
        : undefined,
      issuedAt: body.issuedAt !== undefined
        ? (typeof body.issuedAt === "string" ? body.issuedAt : null)
        : undefined,
      correctionsNotes: typeof body.correctionsNotes === "string"
        ? body.correctionsNotes
        : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    return NextResponse.json({ permit });
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
