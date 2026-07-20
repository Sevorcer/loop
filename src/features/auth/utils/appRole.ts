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

function readRoleFromMetadata(metadata: unknown): AppRole | null {
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

export function resolveAuthUserRole(
  user: Pick<AuthUser, "app_metadata" | "user_metadata"> | null | undefined
): AppRole | null {
  return readRoleFromMetadata(user?.app_metadata) ?? readRoleFromMetadata(user?.user_metadata);
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
