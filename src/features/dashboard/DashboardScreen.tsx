import { DashboardHeader } from "./DashboardHeader";
import { MetricsGrid } from "./MetricsGrid";
import { NeedsAttention } from "./NeedsAttention";
import { QuickActions } from "./QuickActions";
import { RecentActivity } from "./RecentActivity";

export function DashboardScreen() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader />

      <NeedsAttention />

      <MetricsGrid />

      <RecentActivity />
      <QuickActions />
    </div>
  );
}
