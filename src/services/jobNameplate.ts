import "server-only";

import {
  MAX_NAMEPLATE_PHOTOS_TO_READ,
  MAX_NAMEPLATE_READ_BYTES,
  NAMEPLATE_NO_NAMEPLATE_MESSAGE,
  NAMEPLATE_NO_PHOTOS_MESSAGE,
  NAMEPLATE_UNCONFIGURED_MESSAGE,
  effectiveNameplateMime,
  isNameplateCandidate,
  type NameplateExtraction,
} from "@/features/installed-systems/utils/nameplateRead";
import { downloadStorageObjectBytes } from "@/repositories/storage";
import type { AppRole } from "@/services/authorization";
import { listJobFiles } from "@/services/jobs";
import { extractNameplateFromImage, isNameplateVisionConfigured } from "@/services/nameplateVision";

export interface JobNameplateSearch {
  status: "proposed" | "unreadable";
  extraction: NameplateExtraction;
  photoFileName: string | null;
  message: string;
}

/**
 * Look through the photos already uploaded on a job for an equipment
 * nameplate. Stops at the first photo that yields both a model and a
 * serial. Does not write either field.
 */
export async function searchJobPhotosForNameplate(jobId: string, role: AppRole): Promise<JobNameplateSearch> {
  const files = await listJobFiles(jobId, role);
  const photos = files.filter(isNameplateCandidate).slice(0, MAX_NAMEPLATE_PHOTOS_TO_READ);
  if (photos.length === 0) {
    return {
      status: "unreadable",
      extraction: { status: "unreadable", modelNumber: null, serialNumber: null, message: NAMEPLATE_NO_PHOTOS_MESSAGE },
      photoFileName: null,
      message: NAMEPLATE_NO_PHOTOS_MESSAGE,
    };
  }
  if (!isNameplateVisionConfigured()) {
    return {
      status: "unreadable",
      extraction: {
        status: "unreadable",
        modelNumber: null,
        serialNumber: null,
        message: NAMEPLATE_UNCONFIGURED_MESSAGE,
      },
      photoFileName: null,
      message: NAMEPLATE_UNCONFIGURED_MESSAGE,
    };
  }

  let partial: { fileName: string; extraction: NameplateExtraction } | null = null;
  for (const photo of photos) {
    if (photo.sizeBytes > MAX_NAMEPLATE_READ_BYTES) continue;
    const bytes = await downloadStorageObjectBytes(photo.id);
    if (!bytes) continue;
    const extraction = await extractNameplateFromImage(bytes, effectiveNameplateMime(photo));
    if (extraction.status !== "read") continue;
    if (extraction.modelNumber && extraction.serialNumber) {
      return {
        status: "proposed",
        extraction,
        photoFileName: photo.fileName,
        message: extraction.message,
      };
    }
    if (!partial) partial = { fileName: photo.fileName, extraction };
  }

  if (partial) {
    return {
      status: "proposed",
      extraction: partial.extraction,
      photoFileName: partial.fileName,
      message: partial.extraction.message,
    };
  }

  return {
    status: "unreadable",
    extraction: {
      status: "unreadable",
      modelNumber: null,
      serialNumber: null,
      message: NAMEPLATE_NO_NAMEPLATE_MESSAGE,
    },
    photoFileName: null,
    message: NAMEPLATE_NO_NAMEPLATE_MESSAGE,
  };
}
