"use client";

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
 * Resolves the application role from Supabase user metadata.
 *
 * Fallback order:
 * 1. `app_metadata.role`
 * 2. `app_metadata.app_role`
 * 3. `user_metadata.role`
 * 4. `user_metadata.app_role`
 */
export function resolveAuthUserRole(
  user: Pick<AuthUser, "app_metadata" | "user_metadata"> | null | undefined
): AppRole | null {
  return (
    extractRoleFromMetadata(user?.app_metadata) ??
    extractRoleFromMetadata(user?.user_metadata)
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
