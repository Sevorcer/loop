import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { deleteJobSignature } from "@/services/jobSignatures";

interface RouteContext {
  params: Promise<{ id: string; signatureId: string }>;
}

/**
 * DELETE /api/jobs/[id]/signature/[signatureId]
 *
 * Deletes a job signature. Owner/manager only.
 * Org-scoping is enforced at the repository layer — a signature belonging to a
 * different organization is treated as not-found.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "job_signatures", "delete");
  if (!guard.ok) return guard.response;

  try {
    const { id, signatureId } = await context.params;
    const deleted = await deleteJobSignature(signatureId, id);

    if (!deleted) {
      return createApiErrorResponse("NOT_FOUND", "Signature not found.", 404);
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
