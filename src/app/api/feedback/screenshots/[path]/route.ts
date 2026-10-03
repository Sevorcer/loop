import "server-only";

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getRepositoryContext } from "@/repositories/supabaseContext";

const FEEDBACK_SCREENSHOTS_BUCKET = "feedback-screenshots";

/**
 * GET /api/feedback/screenshots/:path
 *
 * Serves a feedback screenshot stored in the private feedback-screenshots
 * bucket. Requires feedback-report read access, and the storage object must
 * belong to the caller's org. The storage path is passed URL-encoded as a
 * single route segment because it contains "/" characters
 * (e.g. "feedback/<uuid>-<name>.jpg").
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string }> },
) {
  const guard = await requirePermission(request, "feedback_reports", "select");
  if (!guard.ok) return guard.response;

  try {
    // Next.js already URL-decodes dynamic route params.
    const { path } = await params;
    const storagePath = path ?? "";
    if (!storagePath || storagePath.includes("..")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { supabase, orgId } = await getRepositoryContext();

    // Confirm the object exists in this org's bucket and get its mime type.
    const { data: meta } = await supabase
      .from("storage_objects")
      .select("mime_type")
      .eq("org_id", orgId)
      .eq("bucket", FEEDBACK_SCREENSHOTS_BUCKET)
      .eq("storage_path", storagePath)
      .maybeSingle();

    if (!meta) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: blob, error } = await supabase.storage
      .from(FEEDBACK_SCREENSHOTS_BUCKET)
      .download(storagePath);

    if (error || !blob) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(blob, {
      headers: {
        "Content-Type": meta.mime_type ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return mapRouteError(err);
  }
}
