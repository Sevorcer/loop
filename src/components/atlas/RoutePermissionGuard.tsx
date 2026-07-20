"use client";

/**
 * RoutePermissionGuard — page-level permission wrapper.
 *
 * Handles the loading skeleton → access denied → authorized content lifecycle
 * for full-page creation and editing routes.
 *
 * Usage:
 *   <RoutePermissionGuard table="jobs" action="insert">
 *     <NewJobForm />
 *   </RoutePermissionGuard>
 *
 * Prefer PermissionGuard for inline section-level guards.
 * Use RoutePermissionGuard when the entire page content is gated.
 */

import type { ReactNode } from "react";

import { AccessDenied } from "./AccessDenied";
import { usePermission } from "@/hooks/usePermission";
import type { CoreTable, TableAction } from "@/services/authorization";

interface RoutePermissionGuardProps {
  table: CoreTable;
  action: TableAction;
  children: ReactNode;
  deniedDescription?: string;
}

export function RoutePermissionGuard({
  table,
  action,
  children,
  deniedDescription,
}: RoutePermissionGuardProps) {
  const { allowed, loading } = usePermission(table, action);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        Loading...
      </div>
    );
  }

  if (!allowed) {
    return <AccessDenied description={deniedDescription} />;
  }

  return <>{children}</>;
}
