"use client";

/**
 * usePermission — role-aware permission check hook.
 *
 * Returns { allowed, loading } where:
 * - loading: true  → role not yet resolved (SSR hydration); allowed is false (no flash).
 * - loading: false → allowed reflects `hasPermission(role, table, action)`.
 *
 * Uses the RoleProvider context (via `useCurrentRole`) which is mounted at the
 * shell layout boundary. The `null` role during SSR maps to `loading: true` to
 * prevent any flash of unauthorized content before the role is known.
 *
 * Use this hook when you need the raw boolean in component logic.
 * For declarative JSX guards, prefer <PermissionGuard>.
 */

import { useCurrentRole } from "@/features/auth";
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
  const { role } = useCurrentRole();

  // null role means the RoleProvider hasn't hydrated yet (SSR boundary).
  // Treat as loading to prevent any flash of unauthorized content.
  if (!role) {
    return { allowed: false, loading: true };
  }

  return {
    allowed: hasPermission(role, table, action),
    loading: false,
  };
}
