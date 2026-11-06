import "server-only";

import {
  MAX_NAMEPLATE_READ_BYTES,
  NAMEPLATE_PHOTO_BUCKET,
  NAMEPLATE_UNREADABLE_MESSAGE,
  reviewFromExtraction,
  unreadableExtraction,
  type NameplateReview,
} from "@/features/installed-systems/utils/nameplateRead";
import { getInstalledSystemById } from "@/repositories/installedSystems";
import { downloadStorageObjectBytes, getStorageObjectById } from "@/repositories/storage";
import { extractNameplateFromImage, isNameplateVisionConfigured } from "@/services/nameplateVision";

export type NameplateReviewResult =
  | { ok: false; status: 404; message: string }
  | { ok: true; review: NameplateReview };

/**
 * Suggest model and serial from one photo on this installed system.
 * Does not write either field. Skips downloading the photo when reading
 * is not configured or the file cannot be sent.
 */
export async function reviewNameplatePhoto(systemId: string, photoId: string): Promise<NameplateReviewResult> {
  const system = await getInstalledSystemById(systemId);
  if (!system.ok) {
    throw new Error(system.error.message);
  }
  if (!system.data) {
    return { ok: false, status: 404, message: "Installed system not found." };
  }

  const photo = await getStorageObjectById(photoId);
  if (!photo || photo.installedSystemId !== systemId || photo.bucket !== NAMEPLATE_PHOTO_BUCKET) {
    return { ok: false, status: 404, message: "That photo is not on this installed system." };
  }

  const existingModel = system.data.modelNumber ?? "";
  const existingSerial = system.data.serialNumbers?.[0] ?? "";
  const finish = (message: string) => ({
    ok: true as const,
    review: reviewFromExtraction({
      existingModel,
      existingSerial,
      extraction: unreadableExtraction(message),
    }),
  });

  if (!photo.mimeType.toLowerCase().startsWith("image/")) {
    return finish("This file is not a photo. Model and serial were left unchanged.");
  }
  if (photo.sizeBytes > MAX_NAMEPLATE_READ_BYTES) {
    return finish("This photo is too large to read. Upload one under 8 MB. Model and serial were left unchanged.");
  }
  if (!isNameplateVisionConfigured()) {
    return finish(
      "This photo could not be read. Nameplate reading needs the OPENAI_API_KEY server setting before Loop can read a nameplate. Model and serial were left unchanged.",
    );
  }

  const bytes = await downloadStorageObjectBytes(photoId);
  if (!bytes) {
    return finish("This photo could not be opened. Model and serial were left unchanged.");
  }

  const extraction = await extractNameplateFromImage(bytes, photo.mimeType);
  return {
    ok: true,
    review: reviewFromExtraction({
      existingModel,
      existingSerial,
      extraction: extraction.status === "unreadable" && !extraction.message
        ? unreadableExtraction(NAMEPLATE_UNREADABLE_MESSAGE)
        : extraction,
    }),
  };
}
