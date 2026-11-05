/**
 * Permit Document Upload API — GC Portal v2
 *
 * POST /api/jobs/[id]/permits/document — upload a document to a permit
 *
 * Body: multipart/form-data with `file` and `permitId`
 * Access: office+ roles (owner, manager, office)
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getRepositoryContext } from "@/repositories/supabaseContext";

const OFFICE_PLUS = new Set(["owner", "manager", "office"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_permits", "update");
  if (!guard.ok) return guard.response;

  if (!OFFICE_PLUS.has(guard.ctx.role)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Only office+ roles can upload permit documents.", code: 403 },
      { status: 403 },
    );
  }

  const { id: jobId } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const permitId = formData.get("permitId") as string | null;

    if (!file || !permitId) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "Both 'file' and 'permitId' are required.", code: 400 },
        { status: 400 },
      );
    }

    const ctx = await getRepositoryContext({ userId: guard.ctx.userId });

    // Verify the permit belongs to this job and org
    const { data: permit, error: permitError } = await ctx.supabase
      .from("job_permits")
      .select("id")
      .eq("id", permitId)
      .eq("job_id", jobId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (permitError || !permit) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Permit not found.", code: 404 },
        { status: 404 },
      );
    }

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const storagePath = `${ctx.orgId}/${jobId}/permits/${permitId}/${file.name}`;

    const { error: uploadError } = await ctx.supabase.storage
      .from("job-files")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      throw Object.assign(new Error(uploadError.message), { status: 500 });
    }

    // Create storage_objects metadata row
    const { data: storageObj, error: metaError } = await ctx.supabase
      .from("storage_objects")
      .insert({
        org_id: ctx.orgId,
        bucket: "job-files",
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: guard.ctx.userId,
        job_id: jobId,
        visibility: "internal",
      })
      .select("id")
      .single();

    if (metaError || !storageObj) {
      throw Object.assign(new Error(metaError?.message ?? "Failed to create storage metadata."), { status: 500 });
    }

    // Link the storage object to the permit
    const storageId = (storageObj as Record<string, unknown>).id as string;
    const { error: linkError } = await ctx.supabase
      .from("job_permits")
      .update({ document_storage_id: storageId })
      .eq("id", permitId)
      .eq("org_id", ctx.orgId);

    if (linkError) {
      throw Object.assign(new Error(linkError.message), { status: 500 });
    }

    return NextResponse.json({ success: true, documentStorageId: storageId }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
