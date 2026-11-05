/**
 * Public Portal API — digital manuals for the shared job
 *
 * GET /api/portal/[token]/manuals
 *
 * Access: public (no auth required). Token is the sole authorization, resolved
 * exactly like GET /api/portal/[token]. Returns only confirmed / auto-linked
 * manuals from the "Customer manuals" Drive folder for equipment on the
 * token's job (see services/portalManuals.ts for the scope rules).
 * `url` is the Drive web-view link (folder shared anyone-with-the-link).
 */

import { NextResponse } from "next/server";

import { resolveShareToken } from "@/services/jobShareLinks";
import { getPortalJobManuals } from "@/services/portalManuals";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const resolved = await resolveShareToken(token);
  if (!resolved) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Invalid or expired share link.", code: 404 },
      { status: 404 },
    );
  }

  try {
    const manuals = await getPortalJobManuals(resolved.jobId, resolved.orgId);
    if (!manuals) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Job not found.", code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ systems: manuals.systems });
  } catch {
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Failed to load manuals.", code: 500 },
      { status: 500 },
    );
  }
}
