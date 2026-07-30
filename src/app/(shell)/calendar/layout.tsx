import type { ReactNode } from "react";

import { JobsProvider } from "@/features/jobs/state/JobsProvider";

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return <JobsProvider>{children}</JobsProvider>;
}
