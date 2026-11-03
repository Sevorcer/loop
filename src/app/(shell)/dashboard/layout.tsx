import type { ReactNode } from "react";

import { ContractorsProvider } from "@/features/contractors/state/ContractorsProvider";
import { PropertiesProvider } from "@/features/properties/state/PropertiesProvider";

// The dashboard no longer mounts JobsProvider: its only consumer was the
// Recent Jobs widget, which now fetches a server-limited /api/jobs/recent read
// instead of the full-workspace /api/jobs paginator that timed out here.
export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PropertiesProvider>
      <ContractorsProvider>{children}</ContractorsProvider>
    </PropertiesProvider>
  );
}
