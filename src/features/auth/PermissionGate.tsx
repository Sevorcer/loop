"use client";

/**
 * PermissionGate — renders children only when the current role has permission.
 *
 * While the role is loading (null), nothing is rendered. This prevents any
 * flash of unauthorized content during SSR hydration.
 *
 * Usage:
 * ```tsx
 * <PermissionGate table="customers" action="insert">
 *   <Link href="/customers/new">
 *     <Button>New Customer</Button>
 *   </Link>
 * </PermissionGate>
 * ```
 *
 * An optional `fallback` prop renders alternative content for denied roles:
 * ```tsx
 * <PermissionGate table="jobs" action="delete" fallback={<span>No access</span>}>
 *   <DeleteButton />
 * </PermissionGate>
 * ```
 */

import type { ReactNode } from "react";

import type { CoreTable, TableAction } from "@/services/authorization";
import { usePermission } from "./usePermission";

interface PermissionGateProps {
  table: CoreTable;
  action: TableAction;
  children: ReactNode;
  /** Content to render when the role is denied. Defaults to nothing. */
  fallback?: ReactNode;
}

export function PermissionGate({
  table,
  action,
  children,
  fallback = null,
}: PermissionGateProps) {
  const allowed = usePermission(table, action);

  // null = loading; render nothing to prevent unauthorized flash
  if (allowed === null) return null;

  if (!allowed) return <>{fallback}</>;

  return <>{children}</>;
}
