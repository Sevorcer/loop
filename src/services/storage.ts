import "server-only";

/**
 * Storage service — Sprint 27 #57
 *
 * Business logic wrapper for storage repository operations.
 * Enforces role-aware access, validates inputs, and provides retry semantics.
 *
 * Architecture: UI → Hooks → Services → Repositories → Supabase
 */

import type { AppRole } from "@/services/authorization";

import {
  createSignedUploadUrl as createSignedUploadUrlRecord,
  deleteFile as deleteFileRecord,
  fetchStorageObjectMeta,
  getSignedDownloadUrl,
  getStorageObjectById,
  listStorageObjects,
  recordStorageObject,
  signStoragePaths,
  uploadFile as uploadFileRecord,
} from "@/repositories/storage";
import type { StorageObjectMeta, UploadInput } from "@/repositories/storage";

// ─── Roles allowed to upload/download/delete ──────────────────────────────────

const UPLOAD_ROLES = new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]);
const MANAGE_ROLES = new Set<AppRole>(["owner", "manager"]);

function assertCanUpload(role: AppRole) {
  if (!UPLOAD_ROLES.has(role)) {
    throw new Error(`Role '${role}' is not permitted to upload files.`);
  }
}

function assertCanManage(role: AppRole) {
  if (!MANAGE_ROLES.has(role)) {
    throw new Error(`Role '${role}' is not permitted to manage storage objects.`);
  }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface StorageUploadInput {
  bucket: string;
  /** Destination path within the bucket, e.g. "org-xxx/issues/file.jpg" */
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  file: Uint8Array | ArrayBuffer;
  jobId?: string;
  propertyId?: string;
  installedSystemId?: string;
  /** Defaults to 'internal'; set to 'customer' for portal-visible files */
  visibility?: "internal" | "customer";
  /** UUID of the authenticated user performing the upload */
  uploadedBy?: string | null;
}

/**
 * Upload a file with retry support.
 * Validates caller role before delegating to the repository.
 */
export async function uploadStorageFile(
  role: AppRole,
  input: StorageUploadInput,
): Promise<StorageObjectMeta> {
  assertCanUpload(role);

  if (!input.storagePath || !input.fileName) {
    throw new Error("storagePath and fileName are required.");
  }

  const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
  if (input.sizeBytes > MAX_SIZE_BYTES) {
    throw new Error(`File size exceeds maximum allowed size of 50 MB.`);
  }

  const uploadInput: UploadInput = {
    bucket: input.bucket,
    storagePath: input.storagePath,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    file: input.file,
    jobId: input.jobId,
    propertyId: input.propertyId,
    installedSystemId: input.installedSystemId,
    visibility: input.visibility ?? "internal",
    uploadedBy: input.uploadedBy ?? null,
  };

  return uploadFileRecord(uploadInput, 3);
}

// ─── Direct (signed) upload ───────────────────────────────────────────────────

/**
 * Issues a signed URL so the client can upload a file straight to Storage.
 * The app server never carries the bytes, so large field photos are not
 * killed by the platform's ~4.5 MB request-body limit.
 */
export async function createJobFileSignedUpload(
  role: AppRole,
  input: { bucket: string; storagePath: string },
): Promise<{ signedUrl: string }> {
  assertCanUpload(role);
  if (!input.storagePath) {
    throw new Error("storagePath is required.");
  }
  return createSignedUploadUrlRecord(input.bucket, input.storagePath);
}

export interface CompleteSignedUploadInput {
  bucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  jobId?: string;
  propertyId?: string;
  installedSystemId?: string;
  visibility?: "internal" | "customer";
  uploadedBy?: string | null;
}

/**
 * Finalizes a direct upload: proves the object really landed in Storage
 * (existence + actual size + the content type Storage recorded for it)
 * and only then writes the metadata row the app lists files from.
 */
export async function completeJobFileSignedUpload(
  role: AppRole,
  input: CompleteSignedUploadInput,
): Promise<StorageObjectMeta> {
  assertCanUpload(role);

  const meta = await fetchStorageObjectMeta(input.bucket, input.storagePath);
  if (!meta) {
    throw new Error("The uploaded file was not found in storage. Please try again.");
  }
  if (meta.sizeBytes !== input.sizeBytes) {
    throw new Error(
      `Uploaded file size mismatch (expected ${input.sizeBytes} bytes, storage has ${meta.sizeBytes}). Please try again.`,
    );
  }
  if (meta.mimeType && meta.mimeType.toLowerCase() !== input.mimeType.toLowerCase()) {
    throw new Error(
      `Uploaded file type mismatch (declared ${input.mimeType}, storage recorded ${meta.mimeType}). Please try again.`,
    );
  }

  return recordStorageObject({
    bucket: input.bucket,
    storagePath: input.storagePath,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    jobId: input.jobId,
    propertyId: input.propertyId,
    installedSystemId: input.installedSystemId,
    visibility: input.visibility ?? "internal",
    uploadedBy: input.uploadedBy ?? null,
  });
}

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Generates a signed download URL for a storage object.
 * Validates caller role and org membership before signing.
 */
export async function getDownloadUrl(
  role: AppRole,
  storageObjectId: string,
  expiresInSeconds = 300,
): Promise<string> {
  assertCanUpload(role); // same roles that can upload can download
  return getSignedDownloadUrl(storageObjectId, expiresInSeconds);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Permanently deletes a storage object and its metadata.
 * Only managers and owners may delete.
 */
export async function deleteStorageFile(role: AppRole, storageObjectId: string): Promise<void> {
  assertCanManage(role);
  await deleteFileRecord(storageObjectId);
}

// ─── List metadata ────────────────────────────────────────────────────────────

export async function listFiles(
  role: AppRole,
  filter?: {
    jobId?: string;
    propertyId?: string;
    installedSystemId?: string;
    bucket?: string;
    visibility?: "internal" | "customer";
  },
): Promise<StorageObjectMeta[]> {
  assertCanUpload(role);
  return listStorageObjects(filter);
}

export async function withPhotoPreviewUrls<
  T extends { bucket: string; storagePath: string; mimeType: string },
>(files: T[]): Promise<Array<T & { previewUrl: string | null }>> {
  const signed = new Map<string, string>();
  const pathsByBucket = new Map<string, string[]>();
  for (const file of files) {
    if (!file.mimeType.toLowerCase().startsWith("image/")) continue;
    const paths = pathsByBucket.get(file.bucket) ?? [];
    paths.push(file.storagePath);
    pathsByBucket.set(file.bucket, paths);
  }

  for (const [bucket, paths] of pathsByBucket) {
    const urls = await signStoragePaths(bucket, paths, 600);
    for (const [path, url] of urls) signed.set(`${bucket}:${path}`, url);
  }

  return files.map((file) => ({
    ...file,
    previewUrl: signed.get(`${file.bucket}:${file.storagePath}`) ?? null,
  }));
}

export async function getFileMetadata(
  role: AppRole,
  storageObjectId: string,
): Promise<StorageObjectMeta | null> {
  assertCanUpload(role);
  return getStorageObjectById(storageObjectId);
}
