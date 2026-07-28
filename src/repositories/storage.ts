import "server-only";

/**
 * Storage repository — Sprint 27 #57
 *
 * Wraps Supabase Storage for upload, download, delete, and metadata persistence.
 * All operations are scoped to the calling org via getRepositoryContext().
 *
 * Security model:
 *  - Uploads/downloads use signed URLs generated server-side; no public bucket URLs.
 *  - metadata rows in `storage_objects` track every file with org_id, so RLS
 *    prevents cross-tenant access automatically.
 *  - Portal-visible files must be explicitly marked visibility = 'customer'.
 */

import { getRepositoryContext } from "./supabaseContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StorageObjectRow {
  id: string;
  org_id: string;
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  job_id: string | null;
  property_id: string | null;
  visibility: "internal" | "customer";
  created_at: string;
  updated_at: string;
}

export interface StorageObjectMeta {
  id: string;
  orgId: string;
  bucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  jobId: string | null;
  propertyId: string | null;
  visibility: "internal" | "customer";
  createdAt: string;
}

function mapStorageObject(row: StorageObjectRow): StorageObjectMeta {
  return {
    id: row.id,
    orgId: row.org_id,
    bucket: row.bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploaded_by,
    jobId: row.job_id,
    propertyId: row.property_id,
    visibility: row.visibility,
    createdAt: row.created_at,
  };
}

export interface UploadInput {
  bucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  file: Uint8Array | ArrayBuffer;
  jobId?: string;
  propertyId?: string;
  visibility?: "internal" | "customer";
  /** UUID of the authenticated user performing the upload */
  uploadedBy?: string | null;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Uploads a file to Supabase Storage and persists metadata to `storage_objects`.
 * Retries the upload up to `maxAttempts` times on transient failure.
 */
export async function uploadFile(
  input: UploadInput,
  maxAttempts = 3,
): Promise<StorageObjectMeta> {
  const { supabase, orgId } = await getRepositoryContext();

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error: uploadError } = await supabase.storage
      .from(input.bucket)
      .upload(input.storagePath, input.file, {
        contentType: input.mimeType,
        upsert: false,
      });

    if (!uploadError) {
      break;
    }

    lastError = new Error(uploadError.message);

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }

  if (lastError) {
    throw new Error(`Storage upload failed after ${maxAttempts} attempts: ${lastError.message}`);
  }

  // Persist metadata row
  const { data, error: metaError } = await supabase
    .from("storage_objects")
    .insert({
      org_id: orgId,
      bucket: input.bucket,
      storage_path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      uploaded_by: input.uploadedBy ?? null,
      job_id: input.jobId ?? null,
      property_id: input.propertyId ?? null,
      visibility: input.visibility ?? "internal",
    })
    .select("*")
    .single();

  if (metaError || !data) {
    throw new Error(metaError?.message ?? "Failed to persist storage metadata.");
  }

  return mapStorageObject(data as StorageObjectRow);
}

// ─── Download (signed URL) ────────────────────────────────────────────────────

/**
 * Returns a time-limited signed URL for downloading a file.
 * Verifies the metadata row belongs to the calling org before signing.
 */
export async function getSignedDownloadUrl(
  storageObjectId: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data: meta, error: metaError } = await supabase
    .from("storage_objects")
    .select("bucket,storage_path,org_id")
    .eq("id", storageObjectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (metaError) throw new Error(metaError.message);
  if (!meta) throw new Error("STORAGE_OBJECT_NOT_FOUND");

  const { data: signed, error: signError } = await supabase.storage
    .from(meta.bucket as string)
    .createSignedUrl(meta.storage_path as string, expiresInSeconds);

  if (signError || !signed?.signedUrl) {
    throw new Error(signError?.message ?? "Failed to generate signed URL.");
  }

  return signed.signedUrl;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Deletes a file from Supabase Storage and removes the metadata row.
 * Verifies the metadata row belongs to the calling org.
 */
export async function deleteFile(storageObjectId: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data: meta, error: metaError } = await supabase
    .from("storage_objects")
    .select("bucket,storage_path,org_id")
    .eq("id", storageObjectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (metaError) throw new Error(metaError.message);
  if (!meta) throw new Error("STORAGE_OBJECT_NOT_FOUND");

  const { error: storageError } = await supabase.storage
    .from(meta.bucket as string)
    .remove([meta.storage_path as string]);

  if (storageError) {
    throw new Error(`Storage delete failed: ${storageError.message}`);
  }

  const { error: deleteMetaError } = await supabase
    .from("storage_objects")
    .delete()
    .eq("id", storageObjectId)
    .eq("org_id", orgId);

  if (deleteMetaError) {
    throw new Error(`Metadata delete failed: ${deleteMetaError.message}`);
  }
}

// ─── List metadata ────────────────────────────────────────────────────────────

export async function listStorageObjects(filter?: {
  jobId?: string;
  propertyId?: string;
  visibility?: "internal" | "customer";
}): Promise<StorageObjectMeta[]> {
  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("storage_objects")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (filter?.jobId) query = query.eq("job_id", filter.jobId);
  if (filter?.propertyId) query = query.eq("property_id", filter.propertyId);
  if (filter?.visibility) query = query.eq("visibility", filter.visibility);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data as StorageObjectRow[]).map(mapStorageObject);
}

export async function getStorageObjectById(id: string): Promise<StorageObjectMeta | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("storage_objects")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapStorageObject(data as StorageObjectRow);
}
