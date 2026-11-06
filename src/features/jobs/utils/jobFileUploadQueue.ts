/**
 * Client-side pending-upload queue helpers for job Photos & Files.
 *
 * Failed uploads stay visible with the real server reason until the user
 * retries successfully or explicitly discards them. The file input is never
 * the only place the selected File lives.
 */

export type PendingUploadStatus = "queued" | "uploading" | "failed";

export interface PendingJobUpload {
  /** Stable client id so React can key the row across retries. */
  clientId: string;
  file: File;
  status: PendingUploadStatus;
  /** Human-readable reason from the server or network, when failed. */
  error: string | null;
  /** Object URL for image previews; revoked on discard/success. */
  previewUrl: string | null;
}

export function createPendingUpload(file: File, clientId: string): PendingJobUpload {
  const isImage = (file.type || "").toLowerCase().startsWith("image/");
  return {
    clientId,
    file,
    status: "queued",
    error: null,
    previewUrl: isImage ? URL.createObjectURL(file) : null,
  };
}

export function revokePendingPreview(item: PendingJobUpload): void {
  if (item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

/**
 * Prefer the API's `message` field (createApiErrorResponse), then `error`,
 * then a generic fallback that still names the file.
 */
export function uploadFailureMessage(
  payload: { message?: string; error?: string } | null | undefined,
  fallback = "Upload failed.",
): string {
  const message = payload?.message?.trim();
  if (message) return message;
  const error = payload?.error?.trim();
  if (error && error !== "INTERNAL_SERVER_ERROR" && error !== "VALIDATION_ERROR") {
    return error;
  }
  if (error && message) return message;
  return fallback;
}

export function formatPendingUploadError(fileName: string, reason: string): string {
  return `${fileName}: ${reason}`;
}
