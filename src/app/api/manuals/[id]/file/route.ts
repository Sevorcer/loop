/**
 * Manual file — serve a stored manual from inside LOOP.
 *
 * GET /api/manuals/:id/file — streams the PDF copy of an indexed manual from
 *   the private `manuals` bucket, inline, so it opens in the tab / in-app
 *   viewer instead of redirecting to Google Drive. Bytes are served through
 *   LOOP; there is no signed-URL redirect to an external host.
 *
 * Roles: same as the manuals list (owner, manager, dispatch, office, sales,
 * tech). portal denied. 404 when the row is not in the caller's org or has no
 * stored copy (callers fall back to the Drive link).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse } from "@/lib/api/routeErrors";
import { canReadManuals } from "@/features/manuals/utils/manualRoles";
import { forbiddenResponse, invalidIdResponse, isUuid, manualErrorResponse } from "@/lib/manuals/routeHelpers";
import { downloadDriveManualFile } from "@/repositories/driveManuals";

/** Header-safe ASCII filename for Content-Disposition (RFC 6266 fallback + UTF-8 form). */
function inlineDisposition(name: string): string {
  const base = name.replace(/\.pdf$/i, "") + ".pdf";
  const ascii = base.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(base)}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "knowledge_items", "select");
  if (!guard.ok) return guard.response;
  if (!canReadManuals(guard.ctx.role)) return forbiddenResponse("You cannot view manuals.");

  const { id } = await params;
  if (!isUuid(id)) return invalidIdResponse("Manual");

  try {
    const file = await downloadDriveManualFile(id);
    if (!file) return createApiErrorResponse("NOT_FOUND", "This manual has no stored copy.", 404);

    return new NextResponse(file.blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": inlineDisposition(file.name),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return manualErrorResponse(error);
  }
}
