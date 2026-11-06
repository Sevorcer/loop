/**
 * Nameplate reading for an installed system.
 *
 * A photo can suggest a model and serial. Nothing here writes those fields.
 * Saving is a separate, explicit confirmation so an existing value is never
 * replaced just because a photo was uploaded or a read was requested.
 */

import { MAX_JOB_FILE_SIZE_BYTES } from "@/lib/fileValidation";

export const NAMEPLATE_PHOTO_BUCKET = "installed-system-photos";

export const NAMEPLATE_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Formats the vision reader can actually send. HEIC is stored, then refused. */
export const NAMEPLATE_VISION_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Stay under a single vision request. Larger photos are kept, not read. */
export const MAX_NAMEPLATE_READ_BYTES = 8 * 1024 * 1024;

export const NAMEPLATE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export const NAMEPLATE_UNREADABLE_MESSAGE =
  "This photo could not be read. Model and serial were left unchanged.";

export const NAMEPLATE_UNCONFIGURED_MESSAGE =
  "This photo could not be read. Nameplate reading needs the OPENAI_API_KEY server setting before Loop can read a nameplate. Model and serial were left unchanged.";

export const NAMEPLATE_CONFIRM_REQUIRED_MESSAGE =
  "Confirm the model and serial before saving. Nothing was changed.";

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9./_+-]{1,79}$/;

export interface NameplateExtraction {
  status: "read" | "unreadable";
  modelNumber: string | null;
  serialNumber: string | null;
  message: string;
}

export interface NameplateReview {
  status: "proposed" | "unreadable";
  /** Draft for the review form. Null when nothing was proposed. */
  modelNumber: string | null;
  serialNumber: string | null;
  modelFromPhoto: boolean;
  serialFromPhoto: boolean;
  message: string;
}

export function normalizeNameplateMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase().trim();
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

export function validateNameplatePhoto(input: { mimeType: string; sizeBytes: number }): string | null {
  const mimeType = normalizeNameplateMime(input.mimeType);
  if (!NAMEPLATE_PHOTO_MIME_TYPES.has(mimeType)) {
    return "Upload a JPEG, PNG, WebP, or HEIC photo of the nameplate.";
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return "A photo file is required.";
  }
  if (input.sizeBytes > MAX_JOB_FILE_SIZE_BYTES) {
    return "That photo is too large. Maximum size is 20 MB.";
  }
  return null;
}

export function isNameplatePhotoPath(systemId: string, storagePath: string): boolean {
  const prefix = `installed-systems/${systemId}/`;
  return storagePath.startsWith(prefix) && !storagePath.includes("..") && storagePath.length > prefix.length;
}

/**
 * Keep a nameplate token only when it looks like a model or serial.
 * Sentences, empty strings, and values with no digit are dropped.
 */
export function cleanNameplateToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/\s+/g, "");
  if (!TOKEN.test(compact) || !/\d/.test(compact)) return null;
  return compact;
}

export function unreadableExtraction(message: string): NameplateExtraction {
  return { status: "unreadable", modelNumber: null, serialNumber: null, message };
}

/**
 * Turn a model response into an extraction. `readable: false` is always
 * unreadable, even if the payload also contains numbers.
 */
export function extractionFromModelPayload(payload: unknown): NameplateExtraction {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!record || record.readable !== true) {
    return unreadableExtraction(NAMEPLATE_UNREADABLE_MESSAGE);
  }
  const modelNumber = cleanNameplateToken(record.modelNumber);
  const serialNumber = cleanNameplateToken(record.serialNumber);
  if (!modelNumber && !serialNumber) {
    return unreadableExtraction(NAMEPLATE_UNREADABLE_MESSAGE);
  }
  return {
    status: "read",
    modelNumber,
    serialNumber,
    message: "",
  };
}

export function parseNameplateModelContent(content: string): NameplateExtraction {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return extractionFromModelPayload(JSON.parse(trimmed) as unknown);
  } catch {
    return unreadableExtraction(NAMEPLATE_UNREADABLE_MESSAGE);
  }
}

export function reviewFromExtraction(input: {
  existingModel: string;
  existingSerial: string;
  extraction: NameplateExtraction;
}): NameplateReview {
  if (input.extraction.status !== "read") {
    return {
      status: "unreadable",
      modelNumber: null,
      serialNumber: null,
      modelFromPhoto: false,
      serialFromPhoto: false,
      message: input.extraction.message || NAMEPLATE_UNREADABLE_MESSAGE,
    };
  }

  const modelFromPhoto = Boolean(input.extraction.modelNumber);
  const serialFromPhoto = Boolean(input.extraction.serialNumber);
  const existingModel = input.existingModel.trim();
  const existingSerial = input.existingSerial.trim();
  const modelNumber = input.extraction.modelNumber || existingModel;
  const serialNumber = input.extraction.serialNumber || existingSerial;
  const missing: string[] = [];
  if (!modelFromPhoto) missing.push("model");
  if (!serialFromPhoto) missing.push("serial");

  let message = "Review the model and serial read from this photo. Nothing is saved until you confirm.";
  if (missing.length > 0) {
    const kept = missing.filter((field) => (field === "model" ? existingModel : existingSerial));
    const blank = missing.filter((field) => !kept.includes(field));
    const notes = [
      kept.length > 0 ? `The current ${kept.join(" and ")} is filled in so it stays unless you change it.` : "",
      blank.length > 0 ? `Add the ${blank.join(" and ")} before saving.` : "",
    ].filter(Boolean);
    message = `The photo did not include a clear ${missing.join(" or ")}. ${notes.join(" ")} Nothing is saved until you confirm.`;
  }

  return {
    status: "proposed",
    modelNumber,
    serialNumber,
    modelFromPhoto,
    serialFromPhoto,
    message,
  };
}

export function isNameplateSaveAttempt(body: Record<string, unknown>): boolean {
  return "confirm" in body || "modelNumber" in body || "serialNumber" in body;
}

export function decideNameplateSave(body: {
  confirm?: unknown;
  modelNumber?: unknown;
  serialNumber?: unknown;
}): { ok: true; modelNumber: string; serialNumber: string } | { ok: false; message: string } {
  if (body.confirm !== true) {
    return { ok: false, message: NAMEPLATE_CONFIRM_REQUIRED_MESSAGE };
  }
  const modelNumber = typeof body.modelNumber === "string" ? body.modelNumber.trim() : "";
  const serialNumber = typeof body.serialNumber === "string" ? body.serialNumber.trim() : "";
  if (!modelNumber || !serialNumber) {
    return {
      ok: false,
      message: "Model and serial are both required. Existing values were left unchanged.",
    };
  }
  if (modelNumber.length > 80 || serialNumber.length > 80) {
    return { ok: false, message: "Model or serial is too long. Nothing was changed." };
  }
  return { ok: true, modelNumber, serialNumber };
}

/**
 * The confirmed serial becomes the primary serial. Any additional serials
 * already on the system stay after it.
 */
export function mergeConfirmedSerial(existing: readonly string[] | null | undefined, confirmed: string): string[] {
  const next = confirmed.trim();
  const rest = (existing ?? []).map((value) => value.trim()).filter(Boolean);
  const tail = rest.slice(1).filter((value) => value !== next);
  return [next, ...tail];
}
