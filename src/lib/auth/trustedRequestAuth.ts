/**
 * Internal request headers that carry identity from proxy → route handlers.
 *
 * SECURITY:
 * - These headers are NEVER trusted from the client. proxy.ts strips any
 *   incoming values before setting its own after a verified session +
 *   user_profiles lookup (PR #281: roles come only from profiles).
 * - Route handlers only honor them when getClaims()/getUser() confirms the
 *   same user id, so a spoofed header without a matching session is ignored.
 */

export const TRUSTED_USER_HEADER = "x-loop-trusted-user-id";
export const TRUSTED_ROLE_HEADER = "x-loop-trusted-role";
export const TRUSTED_ORG_HEADER = "x-loop-trusted-org-id";

const TRUSTED_HEADERS = [
  TRUSTED_USER_HEADER,
  TRUSTED_ROLE_HEADER,
  TRUSTED_ORG_HEADER,
] as const;

/** Remove any client-supplied trusted-auth headers from a Headers bag. */
export function stripTrustedAuthHeaders(headers: Headers): void {
  for (const name of TRUSTED_HEADERS) {
    headers.delete(name);
  }
}

export interface TrustedRequestAuth {
  userId: string;
  role: string;
  orgId: string | null;
}

export function readTrustedAuthHeaders(request: Request): TrustedRequestAuth | null {
  const userId = request.headers.get(TRUSTED_USER_HEADER)?.trim() ?? "";
  const role = request.headers.get(TRUSTED_ROLE_HEADER)?.trim() ?? "";
  const orgIdRaw = request.headers.get(TRUSTED_ORG_HEADER)?.trim() ?? "";
  if (!userId || !role) return null;
  return { userId, role, orgId: orgIdRaw || null };
}

export function applyTrustedAuthHeaders(
  headers: Headers,
  auth: TrustedRequestAuth,
): void {
  stripTrustedAuthHeaders(headers);
  headers.set(TRUSTED_USER_HEADER, auth.userId);
  headers.set(TRUSTED_ROLE_HEADER, auth.role);
  if (auth.orgId) headers.set(TRUSTED_ORG_HEADER, auth.orgId);
}
