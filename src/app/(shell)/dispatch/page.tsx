import { listJobs } from "@/repositories/jobs";
import { loadDispatchSnapshot } from "@/services/dispatch";
import { DispatchScreen } from "@/features/dispatch";

export default async function DispatchPage() {
  const [jobs, snapshot] = await Promise.all([
    listJobs().catch(() => []),
    loadDispatchSnapshot().catch(() => ({
      plans: [],
      crews: [],
      assignments: [],
      scheduleBlocks: [],
      events: [],
    })),
  ]);

  // loadDispatchSnapshot returns DispatchRepositorySnapshot shape;
  // build the DispatchSnapshot shape expected by DispatchScreen
  const dispatchSnapshot = {
    dispatchPlans: snapshot.plans,
    crewAssignments: snapshot.assignments,
    scheduleBlocks: snapshot.scheduleBlocks,
    dispatchEvents: snapshot.events,
    crews: snapshot.crews,
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

  return <DispatchScreen jobs={jobs} snapshot={dispatchSnapshot} />;
}
