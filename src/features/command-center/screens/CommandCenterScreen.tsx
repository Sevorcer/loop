import { PageHeader } from "@/components/atlas";
import {
  getCommandCenterSnapshot,
  getEmptyCommandCenterSnapshot,
} from "@/repositories/commandCenter";

import { KPIStrip } from "../components/KPIStrip";
import { OperationsTabs } from "../components/OperationsTabs";
import { OnHoldJobsWidget } from "../components/OnHoldJobsWidget";
import { WaitingOnInspectionWidget } from "../components/WaitingOnInspectionWidget";
import { CallbacksWidget } from "../components/CallbacksWidget";
import { UnassignedJobsWidget } from "../components/UnassignedJobsWidget";
import { LateJobsWidget } from "../components/LateJobsWidget";
import { CrewWorkloadWidget } from "../components/CrewWorkloadWidget";
import { ProblemJobsWidget } from "../components/ProblemJobsWidget";

/**
 * CommandCenterScreen — async Server Component.
 *
 * The always-on install manager view. Fetches all operational data at render
 * time and passes it to pure presentation widgets. Page-level revalidation
 * (60 seconds) provides stable refresh behavior suitable for all-day usage.
 *
 * Falls back to an empty-state snapshot on any DB error so the screen
 * always renders rather than throwing a full-page error.
 */
export async function CommandCenterScreen() {
  let snapshot = getEmptyCommandCenterSnapshot();
  let fetchError: string | null = null;

  try {
    snapshot = await getCommandCenterSnapshot();
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Unable to load operational data.";
  }

  const {
    kpis,
    counts,
    onHold,
    inspections,
    callbacks,
    unassigned,
    late,
    personWorkload,
    teamWorkload,
    problemJobs,
  } = snapshot;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page header */}
      <PageHeader
        title="Operations"
        description="Operational health at a glance — risk, workload, and intervention priorities for today."
      />
      <OperationsTabs />

      {/* Error banner — non-blocking, screen still renders */}
      {fetchError && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <strong>Data unavailable:</strong> {fetchError}. Showing empty state — refresh to retry.
        </div>
      )}

      {/* 1 — KPI Strip */}
      <KPIStrip kpis={kpis} />

      {/* 2 — Problem Jobs (full-width, high visibility) */}
      <ProblemJobsWidget problemJobs={problemJobs} />

      {/* 3 — Today's jobs + In Progress moved to the Live tab (Collin, 2026-11-05).
          Their counts still feed the KPI strip above. */}

      {/* 4 — Crew Workload (full-width for table readability) */}
      <CrewWorkloadWidget personWorkload={personWorkload} teamWorkload={teamWorkload} />

      {/* 5 — Waiting queues: On Hold, Inspections */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <OnHoldJobsWidget jobs={onHold} totalCount={counts.onHold} />
        <WaitingOnInspectionWidget jobs={inspections} totalCount={counts.inspections} />
      </div>

      {/* 6 — Risk queues: Late, Unassigned, Callbacks */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
        <LateJobsWidget jobs={late} totalCount={counts.late} />
        <UnassignedJobsWidget jobs={unassigned} totalCount={counts.unassigned} />
        <CallbacksWidget jobs={callbacks} totalCount={counts.callbacks} />
      </div>
    </div>
  );
}
