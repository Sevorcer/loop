export const dynamic = "force-dynamic";

import { redirectTechFromOfficePath } from "@/lib/auth/requireRouteRole";
import { ROUTES } from "@/lib/routes";
import { DashboardScreen } from "@/features/dashboard";

export default async function DashboardPage() {
  await redirectTechFromOfficePath(ROUTES.DASHBOARD);

  return <DashboardScreen />;
}
