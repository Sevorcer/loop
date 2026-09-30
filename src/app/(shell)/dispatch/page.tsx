export const dynamic = "force-dynamic";

import { DispatchScreen } from "@/features/dispatch";
import type { DispatchSnapshot } from "@/features/dispatch/types/dispatch";
import { assembleDispatchSnapshot } from "@/features/dispatch/utils/dispatchUtils";
import {
  loadDispatchJobContext,
  loadDispatchSnapshot,
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
  const [snapshot, jobContext] = await Promise.all([
    loadDispatchSnapshot().catch(() => null),
    loadDispatchJobContext().catch(() => null),
  ]);

  const dispatchSnapshot: DispatchSnapshot = snapshot
    ? {
        ...assembleDispatchSnapshot(
          snapshot.plans,
          snapshot.assignments,
          snapshot.scheduleBlocks,
          snapshot.events,
          snapshot.crews,
        ),
        contractors: jobContext?.contractors ?? [],
        jobContractorIds: jobContext?.jobContractorIds ?? {},
      }
    : EMPTY_DISPATCH_SNAPSHOT;

  return <DispatchScreen snapshot={dispatchSnapshot} />;
}
