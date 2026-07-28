/**
 * File validation — Epic 6: File/Photo Attachments in Job Flow
 *
 * Shared constants and pure helpers used by both server-side API routes and
 * client-side upload UI components. No side-effects; safe to import anywhere.
 */

// ─── Allowed MIME types ───────────────────────────────────────────────────────

export const ALLOWED_JOB_FILE_MIME_TYPES = new Set([
  // Images (field photos, equipment shots)
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  // Documents
  "application/pdf",
]);

/** Accept string suitable for an HTML <input type="file"> */
export const ALLOWED_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

// ─── Size limits ──────────────────────────────────────────────────────────────

/** 20 MB — practical ceiling for field photos over mobile networks */
export const MAX_JOB_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// ─── Validation ───────────────────────────────────────────────────────────────

export interface FileValidationInput {
  mimeType: string;
  sizeBytes: number;
}

/**
 * Validates a file against the job attachment policy.
 * Returns a human-readable error string, or `null` when the file is valid.
 *
 * `image/jpg` is normalized to `image/jpeg` before the allowlist check; some
 * browsers report the non-standard alias but both represent the same format.
 */
export function validateJobFile(input: FileValidationInput): string | null {
  let normalizedType = input.mimeType.toLowerCase().trim();

  // Normalize non-standard alias used by some browsers
  if (normalizedType === "image/jpg") {
    normalizedType = "image/jpeg";
  }

  if (!ALLOWED_JOB_FILE_MIME_TYPES.has(normalizedType)) {
    return `File type "${input.mimeType.toLowerCase().trim()}" is not allowed. Accepted types: JPEG, PNG, WebP, HEIC, PDF.`;
  }

  if (input.sizeBytes > MAX_JOB_FILE_SIZE_BYTES) {
    return `File is too large (${formatFileSize(input.sizeBytes)}). Maximum allowed size is ${formatFileSize(MAX_JOB_FILE_SIZE_BYTES)}.`;
  }

  return null;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats a byte count into a human-readable string.
 * e.g. formatFileSize(1536) → "1.5 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
