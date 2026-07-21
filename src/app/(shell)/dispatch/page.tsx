export const dynamic = "force-dynamic";

import { DispatchScreen } from "@/features/dispatch";
import type { DispatchSnapshot } from "@/features/dispatch/types/dispatch";
import { loadDispatchSnapshot } from "@/services/dispatch";

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
  const snapshot = await loadDispatchSnapshot().catch(() => null);

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

  return <DispatchScreen snapshot={dispatchSnapshot} />;
}
