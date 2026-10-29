/**
 * Same-origin relative paths that are safe to pass to the client router after
 * sign-in. Anything else (absolute URLs, protocol-relative URLs, backslash
 * tricks, encoded slashes, control characters) is rejected.
 */

const DUMMY_ORIGIN = "https://loop.invalid";
const MAX_LENGTH = 2048;

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function decodeOrNull(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Returns a same-origin path (pathname + query + hash), or null when `value`
 * is missing or could navigate off-site.
 */
export function resolveSafeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > MAX_LENGTH) return null;

  // Relative paths only. Reject absolute URLs and protocol-relative URLs
  // before the URL parser can treat them as a different host. Backslashes are
  // rejected because browsers normalize them to forward slashes, which turns
  // "/\host" into a protocol-relative URL.
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return null;
  if (candidate.includes("\\")) return null;
  if (hasControlChars(candidate)) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate, DUMMY_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.origin !== DUMMY_ORIGIN) return null;
  if (parsed.username || parsed.password) return null;

  const pathname = parsed.pathname;
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  if (pathname.includes("\\") || hasControlChars(pathname)) return null;

  const decodedPath = decodeOrNull(pathname);
  const decodedSearch = decodeOrNull(parsed.search);
  const decodedHash = decodeOrNull(parsed.hash);
  if (decodedPath === null || decodedSearch === null || decodedHash === null) return null;

  // A second decode catches double-encoding such as /%252f%252fevil.example,
  // which the URL parser only unwraps once.
  const fullyDecodedPath = decodeOrNull(decodedPath);
  if (fullyDecodedPath === null) return null;

  if (
    !decodedPath.startsWith("/") ||
    decodedPath.startsWith("//") ||
    decodedPath.includes("\\") ||
    hasControlChars(decodedPath)
  ) {
    return null;
  }

  if (
    !fullyDecodedPath.startsWith("/") ||
    fullyDecodedPath.startsWith("//") ||
    fullyDecodedPath.includes("\\") ||
    hasControlChars(fullyDecodedPath)
  ) {
    return null;
  }

  if (hasControlChars(decodedSearch) || decodedSearch.includes("\\")) return null;
  if (hasControlChars(decodedHash) || decodedHash.includes("\\")) return null;

  return `${pathname}${parsed.search}${parsed.hash}`;
}
