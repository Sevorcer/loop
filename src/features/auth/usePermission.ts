"use client";

/**
 * usePermission — query the permission matrix for the current user's role.
 *
 * Returns `true` when the role is allowed to perform `action` on `table`,
 * `false` when denied, and `null` while the role is still loading.
 *
 * The `null` state lets components avoid flashing unauthorized UI during the
 * brief SSR → client hydration window.
 */

import { hasPermission } from "@/services/authorization";
import type { CoreTable, TableAction } from "@/services/authorization";
import { useCurrentRole } from "./RoleContext";

export function usePermission(
  table: CoreTable,
  action: TableAction,
): boolean | null {
  const { role } = useCurrentRole();

  if (role === null) {
    // Role not yet hydrated — treat as denied to prevent unauthorized flash
    return null;
  }

  return hasPermission(role, table, action);
}
