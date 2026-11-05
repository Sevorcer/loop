import { LiveOperationsScreen } from "@/features/live-operations/screens/LiveOperationsScreen";
import type { LiveOpsSnapshot } from "@/features/live-operations/types/liveOps";
import { LIVE_OPS_THRESHOLD_MINUTES } from "@/features/live-operations/types/liveOps";
import { getLiveOpsSnapshot } from "@/repositories/liveOperations";
import { todayInCompanyTimeZone } from "@/lib/timezone";

/**
 * Operations → Live. Always rendered per request: the client re-requests it
 * every 60 s while the tab is visible (router.refresh), so it must never be
 * served from a static cache. Role access (owner, manager, dispatch, office)
 * is enforced by the proxy via shellAccess.ts.
 */
export const dynamic = "force-dynamic";

function emptySnapshot(): LiveOpsSnapshot {
  const now = new Date().toISOString();
  return {
    date: todayInCompanyTimeZone(),
    generatedAt: now,
    dayStartedAt: null,
    thresholdMinutes: LIVE_OPS_THRESHOLD_MINUTES,
    hero: {
      techsWorking: 0,
      techsOnTheWay: 0,
      jobsRunning: 0,
      lateOrLong: 0,
      attentionCount: 0,
      criticalCount: 0,
      health: "healthy",
      healthLabel: "No data",
      lastActivityAt: null,
    },
    techs: [],
    attention: [],
    progress: { total: 0, scheduled: 0, onTheWay: 0, inProgress: 0, completed: 0, onHold: 0 },
    feed: [],
    todayJobs: [],
    inProgressJobs: [],
  };
}

export default async function OperationsLivePage() {
  let snapshot = emptySnapshot();
  let fetchError: string | null = null;
  try {
    snapshot = await getLiveOpsSnapshot();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Unable to load live data.";
  }
  return <LiveOperationsScreen snapshot={snapshot} fetchError={fetchError} />;
}
