import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { captureJobSignature, listJobSignaturesForJob } from "@/services/jobSignatures";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_signatures", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const signatures = await listJobSignaturesForJob(id, guard.ctx.role);
    return NextResponse.json({ signatures });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_signatures", "insert");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const formData = await request.formData();
    const signerName = String(formData.get("signerName") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return createApiErrorResponse("VALIDATION_ERROR", "A signature image is required.", 400);
    }

    const saved = await captureJobSignature(
      id,
      {
        signerName,
        file: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      },
      { actorId: guard.ctx.userId, role: guard.ctx.role },
    );

    return NextResponse.json({ signature: saved }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
