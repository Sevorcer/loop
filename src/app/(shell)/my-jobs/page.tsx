import { redirect } from "next/navigation";

import { MyJobsScreen } from "@/features/my-jobs";
import { canOpenMyJobs, formatTodayLabel } from "@/features/my-jobs/utils/myJobs";
import { ROUTES } from "@/lib/routes";
import { listMyJobsToday } from "@/repositories/myJobs";
import { getCurrentOperator } from "@/services/currentOperator";

export const dynamic = "force-dynamic";

export default async function MyJobsPage() {
  const { appRole } = await getCurrentOperator();
  if (!canOpenMyJobs(appRole)) {
    redirect(ROUTES.SIGN_IN);
  }
  const now = new Date();
  const { cards } = await listMyJobsToday(now);
  return <MyJobsScreen todayLabel={formatTodayLabel(now)} cards={cards} />;
}
