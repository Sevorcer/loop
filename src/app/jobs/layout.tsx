import type { ReactNode } from "react";

import { InstalledSystemsProvider } from "@/features/installed-systems/state/InstalledSystemsProvider";
import { JobsProvider } from "@/features/jobs/state/JobsProvider";

export default function JobsLayout({ children }: { children: ReactNode }) {
  return (
    <JobsProvider>
      <InstalledSystemsProvider>{children}</InstalledSystemsProvider>
    </JobsProvider>
  );
}