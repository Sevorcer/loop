import type { ReactNode } from "react";

import { SessionProvider } from "@/features/auth";
import AppShell from "@/components/layout/AppShell";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
