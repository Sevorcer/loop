import type { ReactNode } from "react";

import AppShell from "@/components/layout/AppShell";
import { RoleProvider } from "@/features/auth";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <RoleProvider>
      <AppShell>{children}</AppShell>
    </RoleProvider>
  );
}
