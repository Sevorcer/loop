import { PageHeader } from "@/components/atlas";
import { InProgressJobsWidget } from "@/features/command-center/components/InProgressJobsWidget";
import { OperationsTabs } from "@/features/command-center/components/OperationsTabs";
import { TodaysJobsWidget } from "@/features/command-center/components/TodaysJobsWidget";

import { ActivityFeed } from "../components/ActivityFeed";
import { DayProgressBar } from "../components/DayProgressBar";
import { LiveAutoRefresh } from "../components/LiveAutoRefresh";
import { LiveHero } from "../components/LiveHero";
import { NeedsAttentionList } from "../components/NeedsAttentionList";
import { TechBoard } from "../components/TechBoard";
import type { LiveOpsSnapshot } from "../types/liveOps";

interface LiveOperationsScreenProps {
  snapshot: LiveOpsSnapshot;
  fetchError?: string | null;
}

/**
 * Operations → Live (rebuilt on real data 2026-11-05).
 *
 * Read-only "right now" view. Every row links to the job; changes happen on
 * the job page or in Dispatch. Refreshes itself every 60 s while visible.
 */
export function LiveOperationsScreen({ snapshot, fetchError = null }: LiveOperationsScreenProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Operations"
        description="Live: who is on which job, what is slipping, and today's activity."
        actions={<LiveAutoRefresh generatedAt={snapshot.generatedAt} />}
      />
      <OperationsTabs />

      {fetchError ? (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <strong>Data unavailable:</strong> {fetchError}. Showing empty state — it will retry on the next refresh.
        </div>
      ) : null}

      <LiveHero hero={snapshot.hero} dayStartedAt={snapshot.dayStartedAt} />

      <NeedsAttentionList items={snapshot.attention} thresholdMinutes={snapshot.thresholdMinutes} />

      <TechBoard techs={snapshot.techs} />

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActivityFeed items={snapshot.feed} />
        </div>
        <DayProgressBar progress={snapshot.progress} />
      </div>

      {/* Moved here from Overview (Collin, 2026-11-05). */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <TodaysJobsWidget jobs={snapshot.todayJobs} totalCount={snapshot.todayJobs.length} />
        <InProgressJobsWidget jobs={snapshot.inProgressJobs} totalCount={snapshot.inProgressJobs.length} />
      </div>
    </div>
  );
}
