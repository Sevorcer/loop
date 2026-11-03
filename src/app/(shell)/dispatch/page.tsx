export const dynamic = "force-dynamic";

import { redirectTechFromOfficePath } from "@/lib/auth/requireRouteRole";
import { ROUTES } from "@/lib/routes";
import { DispatchScreen } from "@/features/dispatch";
import type { DispatchSnapshot } from "@/features/dispatch/types/dispatch";
import { alignDispatchSnapshotWithJobs } from "@/features/dispatch/utils/alignDispatchWithJobs";
import { assembleDispatchSnapshot } from "@/features/dispatch/utils/dispatchUtils";
import { listCalendarTeam, listTimeOff } from "@/repositories/calendarEntries";
import {
  loadBoardDispatchSnapshot,
  loadDispatchJobContext,
} from "@/services/dispatch";

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

  const dispatchSnapshot = jobContext
    ? alignDispatchSnapshotWithJobs(assembled, jobContext.jobs)
    : assembled;

  return <DispatchScreen snapshot={dispatchSnapshot} />;
}
