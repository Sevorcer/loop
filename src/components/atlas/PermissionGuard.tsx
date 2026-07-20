"use client";

/**
 * PermissionGuard — declarative permission gate component.
 *
 * Renders:
 *   - null          while the session is loading (prevents flash-of-unauthorized-content)
 *   - `fallback`    when the resolved role lacks the required permission (default: null)
 *   - `children`    when the resolved role has the required permission
 *
 * Example — hide a button entirely when denied:
 *   <PermissionGuard table="jobs" action="insert">
 *     <Link href="/jobs/new"><Button>New Job</Button></Link>
 *   </PermissionGuard>
 *
 * Example — show an access-denied state instead of a section:
 *   <PermissionGuard table="jobs" action="update" fallback={<AccessDenied />}>
 *     <JobStatusActions ... />
 *   </PermissionGuard>
 */

import type { ReactNode } from "react";

import { usePermission } from "@/hooks/usePermission";
import type { CoreTable, TableAction } from "@/services/authorization";

interface PermissionGuardProps {
  table: CoreTable;
  action: TableAction;
  children: ReactNode;
  /** Rendered when the role is resolved but permission is denied. Defaults to null. */
  fallback?: ReactNode;
}

export function PermissionGuard({
  table,
  action,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const { allowed, loading } = usePermission(table, action);

  if (loading) return null;
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
