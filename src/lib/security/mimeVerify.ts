/**
 * Server-side file type verification using magic bytes.
 *
 * Checks the first bytes of a file to verify its actual type rather than
 * trusting the Content-Type header supplied by the client.
 */

interface MagicSignature {
  bytes: number[];
  offset: number;
  mimeType: string;
}

const SIGNATURES: MagicSignature[] = [
  // JPEG: FF D8 FF
  { bytes: [0xff, 0xd8, 0xff], offset: 0, mimeType: "image/jpeg" },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
    mimeType: "image/png",
  },
  // WebP: RIFF....WEBP
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mimeType: "_riff" },
  // PDF: %PDF
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeType: "application/pdf" },
  // GIF: GIF87a or GIF89a
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mimeType: "image/gif" },
];

const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50]; // "WEBP" at offset 8

/**
 * Detect the actual MIME type of a file from its magic bytes.
 *
 * Returns the detected MIME type, or `null` if the format is not recognized.
 * Supports: JPEG, PNG, WebP, PDF, GIF.
 */
export function detectMimeType(data: Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    if (data.length < sig.offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (data[sig.offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (!match) continue;

    if (sig.mimeType === "_riff") {
      if (data.length < 12) continue;
      let isWebP = true;
      for (let i = 0; i < WEBP_MARKER.length; i++) {
        if (data[8 + i] !== WEBP_MARKER[i]) {
          isWebP = false;
          break;
        }
      }
      if (isWebP) return "image/webp";
      continue;
    }

    return sig.mimeType;
  }

  return null;
}

/**
 * Verify that a file's actual content matches the claimed MIME type.
 *
 * Returns `null` if the file passes verification, or an error message string
 * if the actual content does not match the claimed type.
 *
 * If the actual type cannot be detected (unrecognized format), the file is
 * allowed through — this function only rejects known mismatches.
 */
export function verifyMimeType(
  data: Uint8Array,
  claimedMimeType: string,
): string | null {
  const detected = detectMimeType(data);

  if (detected === null) return null;

  let normalized = claimedMimeType.toLowerCase().trim();
  if (normalized === "image/jpg") normalized = "image/jpeg";

  if (detected !== normalized) {
    return `File content does not match the declared type. Declared: ${normalized}, detected: ${detected}.`;
  }

  return null;
}
