const SIGNATURE_ROLES = new Set(["owner", "manager", "office", "tech"]);
const MAX_SIGNER_NAME_LENGTH = 120;

export function canCaptureSignature(role: string | null | undefined): boolean {
  return SIGNATURE_ROLES.has(role ?? "");
}

/**
 * What still has to be filled in before a signature can be saved.
 * Returns null when the capture is ready.
 */
export function signatureCaptureError(input: {
  signerName: string;
  hasInk: boolean;
}): string | null {
  const name = input.signerName.trim();
  const missing: string[] = [];
  if (!name) missing.push("the customer's name");
  if (!input.hasInk) missing.push("a signature in the box");
  if (missing.length > 0) {
    return `Add ${missing.join(" and ")} before saving.`;
  }
  if (name.length > MAX_SIGNER_NAME_LENGTH) {
    return "Signer name must be 120 characters or less.";
  }
  return null;
}

export function formatSignatureWhen(
  iso: string,
  timeZone = "America/Los_Angeles",
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "an unknown time";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatSignatureCaption(input: {
  signerName: string;
  capturedByName: string;
  capturedAt: string;
  timeZone?: string;
}): string {
  const when = formatSignatureWhen(input.capturedAt, input.timeZone);
  const who = input.capturedByName.trim() || "a teammate";
  return `${input.signerName.trim()} signed ${when}. Captured by ${who}.`;
}
