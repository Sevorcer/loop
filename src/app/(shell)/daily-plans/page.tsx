import { DailyPlansScreen } from '@/features/daily-plans'
import { redirectTechFromOfficePath } from "@/lib/auth/requireRouteRole";
import { ROUTES } from "@/lib/routes";

export default async function DailyPlansPage() {
  await redirectTechFromOfficePath(ROUTES.DAILY_PLANS);
  return <DailyPlansScreen />
}
