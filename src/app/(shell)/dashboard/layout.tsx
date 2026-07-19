import type { ReactNode } from "react";

import { ContractorsProvider } from "@/features/contractors/state/ContractorsProvider";
import { JobsProvider } from "@/features/jobs/state/JobsProvider";
import { PropertiesProvider } from "@/features/properties/state/PropertiesProvider";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PropertiesProvider>
      <JobsProvider>
        <ContractorsProvider>{children}</ContractorsProvider>
      </JobsProvider>
    </PropertiesProvider>
  );
}
