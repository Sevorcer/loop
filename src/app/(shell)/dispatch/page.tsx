export const dynamic = "force-dynamic";

import { listJobs } from "@/repositories/jobs";
import { loadDispatchSnapshot } from "@/services/dispatch";
import { DispatchScreen } from "@/features/dispatch";
import type { DispatchSnapshot } from "@/features/dispatch/types/dispatch";

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
    awaitingCustomer: 0,
    awaitingCrew: 0,
    totalPlans: 0,
  },
};

export default async function DispatchPage() {
  const [jobs, snapshot] = await Promise.all([
    listJobs().catch(() => []),
    loadDispatchSnapshot().catch(() => null),
  ]);

  // loadDispatchSnapshot returns DispatchRepositorySnapshot (plans/assignments/etc.)
  // Map to the DispatchSnapshot shape expected by DispatchScreen.
  const dispatchSnapshot: DispatchSnapshot = snapshot
    ? {
        ...EMPTY_DISPATCH_SNAPSHOT,
        dispatchPlans: snapshot.plans,
        crewAssignments: snapshot.assignments,
        scheduleBlocks: snapshot.scheduleBlocks,
        dispatchEvents: snapshot.events,
        crews: snapshot.crews,
      }
    : EMPTY_DISPATCH_SNAPSHOT;

  return <DispatchScreen jobs={jobs} snapshot={dispatchSnapshot} />;
}
