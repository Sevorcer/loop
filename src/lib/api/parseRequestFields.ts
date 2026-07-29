/**
 * Shared helpers for parsing and normalizing fields from API request bodies.
 */

/**
 * Parses an optional timestamp field from a request body.
 * - If the field is absent (null / undefined), returns undefined (omit from payload).
 * - If the field is an empty string after trimming, returns null (clear the value).
 * - Otherwise returns the trimmed string value.
 */
export function parseOptionalTimestamp(value: unknown): string | null | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || null;
}
