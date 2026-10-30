/**
 * Admin area layout — Sprint 29.
 *
 * Middleware (proxy.ts) already requires a signed-in user for /admin.
 * This layout is the role gate: the profile app_role decides who may see
 * the admin shell. Owners and office managers stay. Technicians are sent
 * to their jobs before any admin markup is served.
 *
 * AdminRoleGuard repeats that decision in the browser so a role change
 * does not flash the admin screens. The server check is the one that counts.
 */

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { AuthProvider, RoleProvider } from "@/features/auth";
import { AdminShell } from "@/features/admin";
import { getAuthSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { canAccessAdminArea, resolveAdminAreaRole, type AppRole } from "@/services/authorization";
import { getCurrentOperator } from "@/services/currentOperator";

import { AdminRoleGuard } from "./AdminRoleGuard";

const VALID_ROLES: ReadonlySet<string> = new Set<AppRole>([
  "owner",
  "manager",
  "dispatch",
  "tech",
  "office",
  "sales",
  "portal",
]);

/**
 * Role stored on the sign-in token. Used only when the profile row has no
 * app_role. Order matches src/lib/api-auth.ts.
 */
function resolveMetadataRole(user: User | null | undefined): AppRole | null {
  const candidates: unknown[] = [
    user?.app_metadata?.app_role,
    user?.user_metadata?.app_role,
    user?.app_metadata?.role,
    user?.user_metadata?.role,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && VALID_ROLES.has(candidate)) {
      return candidate as AppRole;
    }
  }

  return null;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authSession = await getAuthSession();

  // Skip the lookup when there is no session (build without Supabase env,
  // or a request middleware already turned away). A real session is checked
  // against the profile before any admin UI is rendered.
  if (authSession) {
    const operator = await getCurrentOperator();
    const role = resolveAdminAreaRole(operator.appRole, resolveMetadataRole(authSession.user));
    if (!canAccessAdminArea(role)) {
      redirect(ROUTES.JOBS);
    }
  }

  return (
    <AuthProvider initialSession={authSession?.session ?? null}>
      <RoleProvider>
        <AdminRoleGuard>
          <AdminShell>{children}</AdminShell>
        </AdminRoleGuard>
      </RoleProvider>
    </AuthProvider>
  );
}
