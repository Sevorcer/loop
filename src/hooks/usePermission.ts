"use client";

/**
 * usePermission — role-aware permission check hook.
 *
 * Returns { allowed, loading } where:
 * - loading: true  → session not yet resolved; allowed is false (no flash).
 * - loading: false → allowed reflects `hasPermission(role, table, action)`.
 *
 * Use this hook when you need the raw boolean in component logic.
 * For declarative JSX guards, prefer <PermissionGuard>.
 */

import { useSession } from "@/features/auth";
import { hasPermission } from "@/services/authorization";
import type { CoreTable, TableAction } from "@/services/authorization";

interface PermissionResult {
  allowed: boolean;
  loading: boolean;
}

export function usePermission(
  table: CoreTable,
  action: TableAction
): PermissionResult {
  const { role, loading } = useSession();

  if (loading || !role) {
    return { allowed: false, loading: true };
  }

  return {
    allowed: hasPermission(role, table, action),
    loading: false,
  };
}
