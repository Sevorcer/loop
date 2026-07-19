import SurfaceCard from "@/components/layout/SurfaceCard";

import { DashboardHeader } from "./DashboardHeader";
import { MetricsGrid } from "./MetricsGrid";
import { QuickActions } from "./QuickActions";
import { RecentActivity } from "./RecentActivity";

export function DashboardScreen() {
  return (
    <div className="space-y-6">
      <SurfaceCard className="p-6">
        <DashboardHeader />
      </SurfaceCard>

      <MetricsGrid />

      <SurfaceCard className="p-6">
        <QuickActions />
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <RecentActivity />
      </SurfaceCard>
    </div>
  );
}