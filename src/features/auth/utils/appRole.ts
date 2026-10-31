import type { AuthUser } from "@/services/authClient";
import type { AppRole } from "@/services/authorization";

export const DEV_ROLE_KEY = "loop_dev_role";
export const DEFAULT_APP_ROLE: AppRole = "owner";

const VALID_APP_ROLES: ReadonlySet<AppRole> = new Set<AppRole>([
  "owner",
  "manager",
  "dispatch",
  "tech",
  "office",
  "sales",
  "portal",
]);

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && VALID_APP_ROLES.has(value as AppRole);
}

function extractRoleFromMetadata(metadata: unknown): AppRole | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  if (isAppRole(record.role)) {
    return record.role;
  }

  if (isAppRole(record.app_role)) {
    return record.app_role;
  }

  return null;
}

/**
 * Role used for access decisions.
 *
 * The profile row wins. `app_metadata` is only a fallback when the profile
 * has no role. `user_metadata` is editable by the signed-in person and is
 * never consulted.
 */
export function resolveAuthoritativeRole(
  profileRole: string | null | undefined,
  lockedRole: string | null | undefined,
): AppRole | null {
  if (isAppRole(profileRole)) return profileRole;
  return isAppRole(lockedRole) ? lockedRole : null;
}

/** Locked role on the sign-in token. Ignores user-editable metadata. */
export function resolveAuthUserRole(
  user: Pick<AuthUser, "app_metadata" | "user_metadata"> | null | undefined,
): AppRole | null {
  return extractRoleFromMetadata(user?.app_metadata);
}

/**
 * Role shown in the app and used to hide owner-only controls.
 * A dev override is explicit. Otherwise this is the same rule as the API.
 */
export function resolveDisplayedRole(input: {
  profileRole?: string | null;
  appMetadata?: unknown;
  devRole?: AppRole | null;
}): AppRole | null {
  if (input.devRole) return input.devRole;
  return resolveAuthoritativeRole(
    input.profileRole,
    extractRoleFromMetadata(input.appMetadata),
  );
}

export function readStoredDevRole(): AppRole | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(DEV_ROLE_KEY);
    return isAppRole(stored) ? stored : null;
  } catch {
    return null;
  }
}
