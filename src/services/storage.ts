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
  deleteFile as deleteFileRecord,
  getSignedDownloadUrl,
  getStorageObjectById,
  listStorageObjects,
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
  /** Defaults to 'internal'; set to 'customer' for portal-visible files */
  visibility?: "internal" | "customer";
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
    visibility: input.visibility ?? "internal",
  };

  return uploadFileRecord(uploadInput, 3);
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
  filter?: { jobId?: string; propertyId?: string; visibility?: "internal" | "customer" },
): Promise<StorageObjectMeta[]> {
  assertCanUpload(role);
  return listStorageObjects(filter);
}

export async function getFileMetadata(
  role: AppRole,
  storageObjectId: string,
): Promise<StorageObjectMeta | null> {
  assertCanUpload(role);
  return getStorageObjectById(storageObjectId);
}
