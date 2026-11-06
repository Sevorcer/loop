import { Suspense } from "react";

import { PrintDailyPlanScreen } from "@/features/daily-plans/screens/PrintDailyPlanScreen";
import { redirectTechFromOfficePath } from "@/lib/auth/requireRouteRole";
import { ROUTES } from "@/lib/routes";

export default async function DailyPlansPrintPage() {
  await redirectTechFromOfficePath(ROUTES.DAILY_PLANS);
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading print view…</div>}>
      <PrintDailyPlanScreen />
    </Suspense>
  );
}
