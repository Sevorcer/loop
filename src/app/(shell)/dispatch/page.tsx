export const dynamic = "force-dynamic";

import { redirectTechFromOfficePath } from "@/lib/auth/requireRouteRole";
import { ROUTES } from "@/lib/routes";
import { DispatchScreen } from "@/features/dispatch";
import type { DispatchSnapshot } from "@/features/dispatch/types/dispatch";
import { alignDispatchSnapshotWithJobs } from "@/features/dispatch/utils/alignDispatchWithJobs";
import { assembleDispatchSnapshot } from "@/features/dispatch/utils/dispatchUtils";
import { countInstallsAtRisk } from "@/features/dispatch/utils/materialRisk";
import { applyPrepReadiness } from "@/features/dispatch/utils/prepReadiness";
import { todayInCompanyTimeZone } from "@/lib/timezone";
import { getPlanReadinessForJobs } from "@/services/readiness";
import { listCalendarTeam, listTimeOff } from "@/repositories/calendarEntries";
import {
  loadBoardDispatchSnapshot,
  loadDispatchJobContext,
} from "@/services/dispatch";
import {
  getJobMaterialSummaries,
  getSystemCountsForProperties,
} from "@/services/jobMaterials";

const EMPTY_DISPATCH_SNAPSHOT: DispatchSnapshot = {
  dispatchPlans: [],
  crewAssignments: [],
  scheduleBlocks: [],
  dispatchEvents: [],
  crews: [],
  metrics: {
    readyToSchedule: 0,
    scheduled: 0,
    inProgress: 0,
    awaitingMaterials: 0,
    awaitingTechnicalReadiness: 0,
    awaitingCustomer: 0,
    awaitingCrew: 0,
    totalPlans: 0,
  },
};

export default async function DispatchPage() {
  await redirectTechFromOfficePath(ROUTES.DISPATCH);
  // The board reads the windowed snapshot (active plans of any date plus
  // the last 7 days of completions) — the full history made this page load
  // thousands of completed plans it never displays.
  // The job context is scoped to the jobs the snapshot's plans point at,
  // so it loads after the snapshot rather than in parallel with it.
  const [snapshot, people, timeOff] = await Promise.all([
    loadBoardDispatchSnapshot().catch(() => null),
    listCalendarTeam().catch(() => []),
    listTimeOff().catch(() => []),
  ]);
  const jobContext = snapshot
    ? await loadDispatchJobContext(snapshot.plans).catch(() => null)
    : null;

  const assembled: DispatchSnapshot = snapshot
    ? {
        ...assembleDispatchSnapshot(
          snapshot.plans,
          snapshot.assignments,
          snapshot.scheduleBlocks,
          snapshot.events,
          snapshot.crews,
          jobContext ? new Set(jobContext.jobIds) : undefined,
        ),
        contractors: jobContext?.contractors ?? [],
        jobContractorIds: jobContext?.jobContractorIds ?? {},
        people,
        timeOff: timeOff.map((entry) => ({
          userId: entry.userId,
          personName: entry.personName,
          startsAt: entry.startsAt,
          endsAt: entry.endsAt,
          reason: entry.reason,
        })),
      }
    : EMPTY_DISPATCH_SNAPSHOT;

  const aligned = jobContext
    ? alignDispatchSnapshotWithJobs(assembled, jobContext.jobs)
    : assembled;

  // #23: Materials / Technical chips from real data (one small read each,
  // in parallel; a failure leaves the stored chips as they were).
  const jobPropertyIds: Record<string, string | null> = {};
  for (const job of jobContext?.jobs ?? []) jobPropertyIds[job.id] = job.propertyId ?? null;
  const jobIds = Object.keys(jobPropertyIds);
  const propertyIds = [
    ...new Set(Object.values(jobPropertyIds).filter((id): id is string => !!id)),
  ];
  const [materialSummaries, systemCounts, planReadiness] = await Promise.all([
    getJobMaterialSummaries(jobIds).catch(() => null),
    getSystemCountsForProperties(propertyIds).catch(() => null),
    getPlanReadinessForJobs(jobIds).catch(() => null),
  ]);
  const dispatchSnapshot =
    materialSummaries || systemCounts || planReadiness
      ? applyPrepReadiness(aligned, {
          materialSummaries: materialSummaries ?? {},
          jobPropertyIds: systemCounts ? jobPropertyIds : {},
          systemCounts: systemCounts ?? {},
          planReadiness: planReadiness ?? {},
        })
      : aligned;

  const installsAtRisk = planReadiness
    ? countInstallsAtRisk(jobContext?.jobs ?? [], planReadiness, todayInCompanyTimeZone())
    : null;

  return <DispatchScreen snapshot={dispatchSnapshot} installsAtRisk={installsAtRisk} />;
}
