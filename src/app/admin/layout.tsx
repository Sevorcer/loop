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
 */

import type { ReactNode } from "react";

import { AuthProvider, RoleProvider } from "@/features/auth";
import { AdminShell } from "@/features/admin"; import { AdminRoleGuard } from "./AdminRoleGuard";
import { getAuthSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authSession = await getAuthSession();

  return (
    <AuthProvider initialSession={authSession?.session ?? null}>
      <RoleProvider>
        <AdminRoleGuard><AdminShell>{children}</AdminShell></AdminRoleGuard>
      </RoleProvider>
    </AuthProvider>
  );
}
