"use client";

import { useMemo } from "react";
import { CalendarDays, Zap } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/atlas";
import { useDailyPlans } from "@/features/daily-plans/state/DailyPlansProvider";
import { getTodayDate } from "@/features/daily-plans/utils/planUtils";
import { ROUTES } from "@/lib/routes";

import { getMockLiveOpsSnapshot } from "../data/mockLiveOps";
import { ActiveCrewBoard } from "../components/ActiveCrewBoard";
import { DecisionFeed } from "../components/DecisionFeed";
import { LiveOpsHero } from "../components/LiveOpsHero";
import { MilestoneProgress } from "../components/MilestoneProgress";
import { NeedsAttention } from "../components/NeedsAttention";
import { OperationalHealth } from "../components/OperationalHealth";
import { OperationalTimeline } from "../components/OperationalTimeline";

// ------------------------------------------------------------------
// Not-started guard — shown when today's plan hasn't been activated
// ------------------------------------------------------------------

function DayNotStarted() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl border border-indigo-500/20 bg-indigo-500/10">
        <Zap className="h-8 w-8 text-indigo-300" />
      </div>

      <h2 className="text-xl font-semibold text-white">Live Operations is not active</h2>

      <p className="mt-3 max-w-sm text-sm leading-7 text-slate-400">
        Live Operations becomes available once today&apos;s operations have been
        started from Morning Operations.
      </p>

      <Link
        href={ROUTES.DAILY_PLANS}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.09] hover:text-white"
      >
        <CalendarDays className="h-4 w-4" />
        Go to Morning Operations
      </Link>
    </div>
  );
}

// ------------------------------------------------------------------
// Main screen
// ------------------------------------------------------------------

export function LiveOperationsScreen() {
  const { getPlanStatus, getPlanActivation } = useDailyPlans();

  const today = getTodayDate();
  const planStatus = getPlanStatus(today);
  const planActivation = getPlanActivation(today);

  const isActive = planStatus === "active";

  // Derive the full snapshot from the shared event stream.
  // This is the ONLY place derivation happens — all components
  // receive their data from this single snapshot.
  const startedAt = planActivation?.startedAt ?? null;
  const snapshot = useMemo(() => {
    if (!isActive || !startedAt) return null;
    return getMockLiveOpsSnapshot(today, startedAt);
  }, [isActive, startedAt, today]);

  if (!isActive || !snapshot) {
    return <DayNotStarted />;
  }

  const { heroMetrics, health, crews, workOrders, events, decisions, attention } = snapshot;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page header */}
      <PageHeader
        title="Live Operations"
        description="Real-time visibility into active crews, job progress, and field decisions as the day unfolds."
      />

      {/* 1 — Operations Overview Hero */}
      <LiveOpsHero
        date={today}
        startedAt={snapshot.startedAt}
        metrics={heroMetrics}
        health={health}
      />

      {/* 2 + 3 — Decision Feed and Needs Attention */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <DecisionFeed decisions={decisions} />
        <NeedsAttention attention={attention} />
      </div>

      {/* 4 — Active Crew Board */}
      <ActiveCrewBoard crews={crews} />

      {/* 5 + 7 — Timeline and Health */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <OperationalTimeline events={events} />
        </div>
        <div className="space-y-4 sm:space-y-6">
          <OperationalHealth health={health} />
          <MilestoneProgress workOrders={workOrders} />
        </div>
      </div>
    </div>
  );
}
