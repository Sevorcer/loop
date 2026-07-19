import type { ReactNode } from "react";

import { ContractorsProvider } from "@/features/contractors/state/ContractorsProvider";
import { InstalledSystemsProvider } from "@/features/installed-systems/state/InstalledSystemsProvider";
import { JobsProvider } from "@/features/jobs/state/JobsProvider";

export default function JobsLayout({ children }: { children: ReactNode }) {
  return (
    <JobsProvider>
      <ContractorsProvider>
        <InstalledSystemsProvider>{children}</InstalledSystemsProvider>
      </ContractorsProvider>
    </JobsProvider>
  );
}