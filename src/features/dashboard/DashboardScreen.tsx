import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { DashboardHeader } from "./DashboardHeader";
import { HomeSummaryCards } from "./HomeSummaryCards";
import { MetricsGrid } from "./MetricsGrid";
import { NeedsAttention } from "./NeedsAttention";
import { QuickActions } from "./QuickActions";
import { RecentActivity } from "./RecentActivity";
import { RecentJobsList } from "./RecentJobsList";

export function DashboardScreen() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader />

      <HomeSummaryCards />

      <NeedsAttention />

      <MetricsGrid />

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RecentJobsList />
          </CardContent>
        </Card>

        <QuickActions />
      </div>

      <RecentActivity />
    </div>
  );
}
