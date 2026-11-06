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
  uploaderRole: string | null;
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
    uploaderRole: null,
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

  return insertStorageObjectMeta(supabase, orgId, input);
}

/** Persists the `storage_objects` metadata row for an uploaded object. */
async function insertStorageObjectMeta(
  supabase: Awaited<ReturnType<typeof getRepositoryContext>>["supabase"],
  orgId: string,
  input: Omit<UploadInput, "file">,
): Promise<StorageObjectMeta> {
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

/**
 * Records metadata for an object the client already uploaded directly to
 * Storage through a signed upload URL (see createSignedUploadUrl).
 */
export async function recordStorageObject(input: Omit<UploadInput, "file">): Promise<StorageObjectMeta> {
  const { supabase, orgId } = await getRepositoryContext();
  return insertStorageObjectMeta(supabase, orgId, input);
}

/**
 * Creates a signed URL the client can PUT a file to directly, so file bytes
 * never pass through the app server (whose platform request-body limit of
 * ~4.5 MB silently killed larger field photos).
 */
export async function createSignedUploadUrl(
  bucket: string,
  storagePath: string,
): Promise<{ signedUrl: string }> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create a signed upload URL.");
  }

  return { signedUrl: data.signedUrl };
}

/**
 * Reads a stored object's metadata — its actual size and the content type
 * recorded at upload — through the Storage list API, without fetching any
 * object bytes. Returns null when the object does not exist.
 *
 * This replaced a signed-URL ranged fetch of the object's first bytes:
 * inside the serverless function that fetch never returned, so the
 * /files/complete route ran into the 300 s invocation timeout on every
 * large upload (Vercel logs, 2026-11-06) and no file could be finalized.
 * The list API answers the same existence/size questions in milliseconds.
 */
export async function fetchStorageObjectMeta(
  bucket: string,
  storagePath: string,
): Promise<{ sizeBytes: number; mimeType: string | null } | null> {
  const { supabase } = await getRepositoryContext();
  const slash = storagePath.lastIndexOf("/");
  const folder = slash >= 0 ? storagePath.slice(0, slash) : "";
  const name = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;

  const PAGE_SIZE = 200;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw new Error(`Storage metadata check failed: ${error.message}`);
    }
    const match = (data ?? []).find((entry) => entry.name === name);
    if (match) {
      const sizeBytes = Number(match.metadata?.size);
      // Folder entries carry no size metadata — a name match without one
      // is not the uploaded file.
      if (!Number.isFinite(sizeBytes)) return null;
      return { sizeBytes, mimeType: match.metadata?.mimetype ?? null };
    }
    if (!data || data.length < PAGE_SIZE) return null;
  }
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

/**
 * Signs many files in one storage call per bucket chunk.
 * Used for job photo thumbnails so the phone does not request a URL per photo.
 */
export async function signStoragePaths(
  bucket: string,
  paths: string[],
  expiresInSeconds = 600,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;

  const { supabase } = await getRepositoryContext();
  const chunkSize = 40;
  for (let index = 0; index < paths.length; index += chunkSize) {
    const chunk = paths.slice(index, index + chunkSize);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(chunk, expiresInSeconds);
    if (error || !data) continue;
    for (const item of data) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
  }
  return urls;
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

/**
 * Map profile rows to uploader roles. The column is `app_role`.
 * A query against `role` leaves every photo without a role, and the
 * completion gate then says a technician photo is missing.
 */
export function uploaderRolesByUserId(
  profiles: Array<{ id: string; app_role?: string | null }>,
): Map<string, string> {
  const roleById = new Map<string, string>();
  for (const profile of profiles) {
    if (typeof profile.app_role === "string" && profile.app_role.length > 0) {
      roleById.set(profile.id, profile.app_role);
    }
  }
  return roleById;
}

// ─── List metadata ────────────────────────────────────────────────────────────

export async function listStorageObjects(
  filter?: {
    jobId?: string;
    propertyId?: string;
    visibility?: "internal" | "customer";
  },
  options?: { page?: number; pageSize?: number },
): Promise<StorageObjectMeta[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("storage_objects")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (filter?.jobId) query = query.eq("job_id", filter.jobId);
  if (filter?.propertyId) query = query.eq("property_id", filter.propertyId);
  if (filter?.visibility) query = query.eq("visibility", filter.visibility);

  query = query.range(from, to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data as StorageObjectRow[]).map(mapStorageObject);

  // Enrich with uploader roles so callers can distinguish tech field uploads
  // from office uploads (e.g. the job completion photo gate).
  const uploaderIds = [...new Set(rows.map((row) => row.uploadedBy).filter((id): id is string => Boolean(id)))];
  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, app_role")
      .in("id", uploaderIds);
    const roleById = uploaderRolesByUserId(
      (profiles ?? []) as Array<{ id: string; app_role?: string | null }>,
    );
    for (const row of rows) {
      row.uploaderRole = row.uploadedBy ? roleById.get(row.uploadedBy) ?? null : null;
    }
  }

  return rows;
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

/** Downloads one org-scoped object. Returns null when it is missing or unreadable. */
export async function downloadStorageObjectBytes(id: string): Promise<Uint8Array | null> {
  const meta = await getStorageObjectById(id);
  if (!meta) return null;

  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.storage.from(meta.bucket).download(meta.storagePath);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
