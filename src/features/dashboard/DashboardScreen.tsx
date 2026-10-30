import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary, listDashboardAttentionJobs } from "@/repositories/dashboard";

import { DashboardHeader } from "./DashboardHeader";
import { HomeSummaryCards } from "./HomeSummaryCards";
import { MetricsGrid } from "./MetricsGrid";
import { NeedsAttention } from "./NeedsAttention";
import { QuickActions } from "./QuickActions";
import { RecentActivity } from "./RecentActivity";
import { RecentJobsList } from "./RecentJobsList";
import { buildAttentionItems, type AttentionItem } from "./data/operationalHealth";
import type { DashboardSummary } from "@/repositories/dashboard";

/**
 * DashboardScreen — async Server Component.
 *
 * Fetches live KPI data from Supabase at render time and passes it down to
 * presentation sub-components. No mock data; falls back to zero-state on error
 * so the screen always renders.
 */
const EMPTY_SUMMARY: DashboardSummary = {
  activeJobs: 0,
  completedToday: 0,
  scheduledToday: 0,
  blockedJobs: 0,
  unassignedJobs: 0,
  newCustomersThisMonth: 0,
  totalProperties: 0,
  activeCrews: 0,
  openCallbacks: 0,
  openEstimates: 0,
};

export async function DashboardScreen() {
  let summary: DashboardSummary = EMPTY_SUMMARY;
  let attention: AttentionItem[] = [];
  try {
    summary = await getDashboardSummary();
  } catch {
    summary = EMPTY_SUMMARY;
  }
  try {
    attention = buildAttentionItems(await listDashboardAttentionJobs());
  } catch {
    attention = [];
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardHeader summary={summary} />

      <HomeSummaryCards summary={summary} />

      <NeedsAttention items={attention} />

      <MetricsGrid summary={summary} />

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
