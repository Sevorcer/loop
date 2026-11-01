/**
 * Builds one display address from whichever parts are filled in.
 *
 * Blank, null, and comma-only parts are left out. The result has no leading,
 * trailing, or repeated commas, and no extra spaces around the separator.
 * Returns an empty string when nothing is left, so callers can omit the line.
 *
 * `separator` defaults to a comma. Pass another separator (for example " • ")
 * when a result line is not a postal address but should drop empty parts
 * the same way.
 */
export function joinAddressParts(
  parts: ReadonlyArray<string | null | undefined>,
  separator = ", ",
): string {
  const cleaned: string[] = [];

  for (const part of parts) {
    if (typeof part !== "string") continue;
    const value = cleanAddressPart(part);
    if (value) cleaned.push(value);
  }

  return cleaned.join(separator);
}

function cleanAddressPart(part: string): string {
  const collapsed = part.replace(/\s+/g, " ").trim();
  if (!collapsed) return "";

  return collapsed
    .replace(/\s*,\s*/g, ", ")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/^(?:,\s*)+|(?:,\s*)+$/g, "")
    .trim();
}
