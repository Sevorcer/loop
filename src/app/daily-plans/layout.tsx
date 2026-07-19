import type { ReactNode } from "react";

import { JobsProvider } from "@/features/jobs/state/JobsProvider";
import { DailyPlansProvider } from "@/features/daily-plans/state/DailyPlansProvider";

export default function DailyPlansLayout({ children }: { children: ReactNode }) {
  return (
    <JobsProvider>
      <DailyPlansProvider>{children}</DailyPlansProvider>
    </JobsProvider>
  );
}
