/**
 * Nameplate reading from photos that already belong to a job.
 *
 * A photo can suggest a model and serial. Nothing here writes those fields.
 * Saving is a separate confirmation onto an installed system on that job.
 */

export const NAMEPLATE_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Formats local OCR can read after HEIC has been converted to JPEG. */
export const NAMEPLATE_VISION_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Skip very large photos so one search does not stall the request. */
export const MAX_NAMEPLATE_READ_BYTES = 8 * 1024 * 1024;

/**
 * How many of the job's newest photos one Find nameplate search will open.
 * OCR runs on the server and does not bill per photo, but each image still
 * takes CPU time, so this stays a button rather than a scan on every upload.
 */
export const MAX_NAMEPLATE_PHOTOS_TO_READ = 12;

export const NAMEPLATE_UNREADABLE_MESSAGE =
  "This photo could not be read. Model and serial were left unchanged.";

export const NAMEPLATE_READER_FAILED_MESSAGE =
  "Nameplate reading could not start. Model and serial were left unchanged.";

export const NAMEPLATE_NO_PHOTOS_MESSAGE =
  "This job has no photos to search. Model and serial were left unchanged.";

export const NAMEPLATE_NO_NAMEPLATE_MESSAGE =
  "No nameplate was found in this job's photos. Model and serial were left unchanged.";

export const NAMEPLATE_NO_SYSTEM_MESSAGE =
  "This job has no installed system yet. Model and serial were left unchanged.";

export const NAMEPLATE_CHOOSE_SYSTEM_MESSAGE =
  "Choose which installed system these values belong to. Nothing was changed.";

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
  modelNumber: string | null;
  serialNumber: string | null;
  modelFromPhoto: boolean;
  serialFromPhoto: boolean;
  message: string;
}

export interface NameplatePhotoHit {
  fileId: string;
  fileName: string;
  extraction: NameplateExtraction;
}

export function normalizeNameplateMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase().trim();
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

export function isNameplateCandidate(file: { mimeType: string; fileName: string }): boolean {
  const mime = normalizeNameplateMime(file.mimeType);
  if (NAMEPLATE_PHOTO_MIME_TYPES.has(mime)) return true;
  return /\.(heic|heif|jpe?g|png|webp)$/i.test(file.fileName);
}

/** Mime to decode with, including iPhone photos saved with a generic type. */
export function effectiveNameplateMime(file: { mimeType: string; fileName: string }): string {
  const mime = normalizeNameplateMime(file.mimeType);
  if (NAMEPLATE_PHOTO_MIME_TYPES.has(mime)) return mime;
  if (/\.heic$/i.test(file.fileName) || /\.heif$/i.test(file.fileName)) return "image/heic";
  if (/\.png$/i.test(file.fileName)) return "image/png";
  if (/\.webp$/i.test(file.fileName)) return "image/webp";
  if (/\.jpe?g$/i.test(file.fileName)) return "image/jpeg";
  return mime;
}

export function cleanNameplateToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/\s+/g, "");
  if (!TOKEN.test(compact) || !/\d/.test(compact)) return null;
  return compact;
}

const MODEL_LABEL = /\b(?:model(?:\s*(?:no\.?|number|#))?|m\/n|mdl)\b/i;
const SERIAL_LABEL = /\b(?:serial(?:\s*(?:no\.?|number|#))?|s\/n)\b/i;

function firstNameplateToken(value: string): string | null {
  for (const part of value.split(/[\s,;|]+/)) {
    const token = cleanNameplateToken(part);
    if (token) return token;
  }
  return cleanNameplateToken(value);
}

function valueOnLabelLine(line: string, label: RegExp): string | null {
  const match = label.exec(line);
  if (!match) return null;
  const rest = line.slice(match.index + match[0].length).replace(/^[\s:.#\-_/]+/, "");
  return firstNameplateToken(rest);
}

/**
 * Pull a model and serial only from labeled nameplate text.
 * Unlabeled words are ignored so a random photo cannot invent a number.
 */
export function parseNameplateOcrText(text: string): NameplateExtraction {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let modelNumber: string | null = null;
  let serialNumber: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!modelNumber && MODEL_LABEL.test(line)) {
      modelNumber = valueOnLabelLine(line, MODEL_LABEL)
        ?? (!SERIAL_LABEL.test(lines[index + 1] ?? "") ? firstNameplateToken(lines[index + 1] ?? "") : null);
    }
    if (!serialNumber && SERIAL_LABEL.test(line)) {
      serialNumber = valueOnLabelLine(line, SERIAL_LABEL)
        ?? (!MODEL_LABEL.test(lines[index + 1] ?? "") ? firstNameplateToken(lines[index + 1] ?? "") : null);
    }
  }

  if (!modelNumber && !serialNumber) {
    return unreadableExtraction(NAMEPLATE_UNREADABLE_MESSAGE);
  }
  return {
    status: "read",
    modelNumber,
    serialNumber,
    message: "Read from a job photo.",
  };
}

export function unreadableExtraction(message: string): NameplateExtraction {
  return { status: "unreadable", modelNumber: null, serialNumber: null, message };
}

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
  return { status: "read", modelNumber, serialNumber, message: "" };
}

export function parseNameplateModelContent(content: string): NameplateExtraction {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return extractionFromModelPayload(JSON.parse(trimmed) as unknown);
  } catch {
    return unreadableExtraction(NAMEPLATE_UNREADABLE_MESSAGE);
  }
}

/**
 * Prefer the first photo that has both a model and a serial.
 * A partial read is kept only when nothing better was found.
 */
export function chooseNameplateHit(hits: readonly NameplatePhotoHit[]): NameplatePhotoHit | null {
  const readable = hits.filter((hit) => hit.extraction.status === "read");
  return (
    readable.find((hit) => hit.extraction.modelNumber && hit.extraction.serialNumber) ??
    readable[0] ??
    null
  );
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
      message: input.extraction.message || NAMEPLATE_NO_NAMEPLATE_MESSAGE,
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

  let message = "Review the model and serial read from this job's photos. Nothing is saved until you confirm.";
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
  return "confirm" in body || "modelNumber" in body || "serialNumber" in body || "installedSystemId" in body;
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

export function mergeConfirmedSerial(existing: readonly string[] | null | undefined, confirmed: string): string[] {
  const next = confirmed.trim();
  const rest = (existing ?? []).map((value) => value.trim()).filter(Boolean);
  const tail = rest.slice(1).filter((value) => value !== next);
  return [next, ...tail];
}

export interface NameplateSystemChoice {
  id: string;
}

/**
 * One installed system on the job is the target. Several systems require
 * an explicit choice. A system that is not on the job is refused.
 */
export function resolveNameplateSystem(
  systems: readonly NameplateSystemChoice[],
  requestedId: unknown,
): { ok: true; id: string } | { ok: false; message: string } {
  if (systems.length === 0) {
    return { ok: false, message: NAMEPLATE_NO_SYSTEM_MESSAGE };
  }
  if (systems.length === 1) {
    if (typeof requestedId === "string" && requestedId.length > 0 && requestedId !== systems[0].id) {
      return { ok: false, message: "That installed system is not on this job. Nothing was changed." };
    }
    return { ok: true, id: systems[0].id };
  }
  if (typeof requestedId !== "string" || !systems.some((system) => system.id === requestedId)) {
    return { ok: false, message: NAMEPLATE_CHOOSE_SYSTEM_MESSAGE };
  }
  return { ok: true, id: requestedId };
}
