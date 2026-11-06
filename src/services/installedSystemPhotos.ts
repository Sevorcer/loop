import "server-only";

import { randomUUID } from "crypto";

import {
  NAMEPLATE_PHOTO_BUCKET,
  isNameplatePhotoPath,
  validateNameplatePhoto,
} from "@/features/installed-systems/utils/nameplateRead";
import { normalizeUploadFileName } from "@/lib/fileValidation";
import { listStorageObjects } from "@/repositories/storage";
import type { AppRole } from "@/services/authorization";
import {
  completeJobFileSignedUpload,
  createJobFileSignedUpload,
  withPhotoPreviewUrls,
} from "@/services/storage";

export interface InstalledSystemPhoto {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
  previewUrl: string | null;
}

export async function listInstalledSystemPhotos(systemId: string): Promise<InstalledSystemPhoto[]> {
  const files = await listStorageObjects({
    installedSystemId: systemId,
    bucket: NAMEPLATE_PHOTO_BUCKET,
  });
  let withPreviews: Array<(typeof files)[number] & { previewUrl: string | null }> = [];
  try {
    withPreviews = await withPhotoPreviewUrls(files);
  } catch {
    withPreviews = files.map((file) => ({ ...file, previewUrl: null }));
  }
  return withPreviews.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    createdAt: file.createdAt,
    previewUrl: file.previewUrl,
  }));
}

export async function signInstalledSystemPhoto(
  role: AppRole,
  systemId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number },
): Promise<{ signedUrl: string; storagePath: string; fileName: string }> {
  const validationError = validateNameplatePhoto({ mimeType: input.mimeType, sizeBytes: input.sizeBytes });
  if (validationError) {
    throw Object.assign(new Error(validationError), { status: 400 });
  }
  const fileName = normalizeUploadFileName(input.fileName);
  const storagePath = `installed-systems/${systemId}/${randomUUID()}-${fileName}`;
  const { signedUrl } = await createJobFileSignedUpload(role, {
    bucket: NAMEPLATE_PHOTO_BUCKET,
    storagePath,
  });
  return { signedUrl, storagePath, fileName };
}

export async function completeInstalledSystemPhoto(
  role: AppRole,
  systemId: string,
  input: { storagePath: string; fileName: string; mimeType: string; sizeBytes: number; uploadedBy: string | null },
): Promise<InstalledSystemPhoto> {
  if (!isNameplatePhotoPath(systemId, input.storagePath)) {
    throw Object.assign(new Error("A signed upload for this installed system is required."), { status: 400 });
  }
  const validationError = validateNameplatePhoto({ mimeType: input.mimeType, sizeBytes: input.sizeBytes });
  if (validationError) {
    throw Object.assign(new Error(validationError), { status: 400 });
  }

  const uploaded = await completeJobFileSignedUpload(role, {
    bucket: NAMEPLATE_PHOTO_BUCKET,
    storagePath: input.storagePath,
    fileName: normalizeUploadFileName(input.fileName),
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    installedSystemId: systemId,
    visibility: "internal",
    uploadedBy: input.uploadedBy,
  });

  return {
    id: uploaded.id,
    fileName: uploaded.fileName,
    mimeType: uploaded.mimeType,
    createdAt: uploaded.createdAt,
    previewUrl: null,
  };
}
