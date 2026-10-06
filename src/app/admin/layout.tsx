/**
 * Admin area layout — Sprint 29.
 *
 * Wraps all /admin/* routes with:
 *   - Supabase session resolution (same pattern as shell layout)
 *   - AuthProvider + RoleProvider for client components
 *   - AdminShell for the admin-specific sidebar nav
 *
 * Authentication enforcement is handled at the middleware layer (proxy.ts).
 * This layout can rely on the user being authenticated.
 *
 * Authorization is enforced here on the server: only the `owner` role may
 * render the admin shell. Non-owners are redirected to /jobs before any
 * admin markup is served. The client-side AdminRoleGuard remains for UX
 * (fast redirect / no content flash), but this server check is the real
 * enforcement boundary.
 */

import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AuthProvider, RoleProvider } from "@/features/auth";
import { AdminShell } from "@/features/admin"; import { AdminRoleGuard } from "./AdminRoleGuard";
import { getAuthSession } from "@/lib/auth/session";
import type { AppRole } from "@/services/authorization";
import type { User } from "@supabase/supabase-js";

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
 * Resolves the app role from Supabase auth metadata using the same priority
 * order as the API layer (src/lib/api-auth.ts):
 * app_metadata.app_role → user_metadata.app_role →
 * app_metadata.role → user_metadata.role.
 */
function resolveServerRole(user: User | null | undefined): AppRole | null {
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

  // Server-side enforcement: only owners may render the admin shell.
  // Unknown roles fail closed the same way as non-owners.
  if (authSession && resolveServerRole(authSession.user) !== "owner") {
    redirect("/jobs");
  }

  return (
    <AuthProvider initialSession={authSession?.session ?? null}>
      <RoleProvider>
        <AdminRoleGuard><AdminShell>{children}</AdminShell></AdminRoleGuard>
      </RoleProvider>
    </AuthProvider>
  );
}
