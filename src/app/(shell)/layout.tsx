import type { ReactNode } from "react";

import AppShell from "@/components/layout/AppShell";
import { AuthProvider, RoleProvider } from "@/features/auth";
import { getAuthSession } from "@/lib/auth/session";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  // Resolve session server-side so AuthProvider can hydrate without a loading
  // flash. The middleware already validated the session, so this is safe.
  const authSession = await getAuthSession();

  return (
    <AuthProvider initialSession={authSession?.session ?? null}>
      <RoleProvider>
        <AppShell>{children}</AppShell>
      </RoleProvider>
    </AuthProvider>
  );
}
