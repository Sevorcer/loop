import type { ReactNode } from "react";

import { DailyPlansProvider } from "@/features/daily-plans/state/DailyPlansProvider";

export default function LiveOperationsLayout({ children }: { children: ReactNode }) {
  return <DailyPlansProvider>{children}</DailyPlansProvider>;
}
