import type {
  CrewAssignment,
  DispatchEvent,
  DispatchPlan,
  DispatchSnapshot,
} from "../types/dispatch";
import { getDispatchBoardGroup } from "./dispatchUtils";

type DispatchQueueKey = "active" | "ready" | "scheduled" | "blocked";

export interface DispatchQueueSection {
  key: DispatchQueueKey;
  label: string;
  description: string;
  plans: DispatchPlan[];
}

const DISPATCH_QUEUE_ORDER: DispatchQueueKey[] = [
  "active",
  "ready",
  "scheduled",
  "blocked",
];

const PRIORITY_RANK: Record<DispatchPlan["priority"], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const DISPATCH_QUEUE_META: Record<
  DispatchQueueKey,
  Omit<DispatchQueueSection, "plans">
> = {
  active: {
    key: "active",
    label: "In Progress",
    description: "Jobs currently being executed in the field.",
  },
  ready: {
    key: "ready",
    label: "Ready to Schedule",
    description: "Work that is operationally ready for schedule placement.",
  },
  scheduled: {
    key: "scheduled",
    label: "Scheduled",
    description: "Work with a crew and date already committed.",
  },
  blocked: {
    key: "blocked",
    label: "Blocked",
    description: "Work waiting on readiness, customer, crew, or materials.",
  },
};

function comparePlanPriority(left: DispatchPlan, right: DispatchPlan) {
  const priorityDelta = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const leftDate = left.targetDate ? new Date(left.targetDate).getTime() : Number.MAX_SAFE_INTEGER;
  const rightDate = right.targetDate
    ? new Date(right.targetDate).getTime()
    : Number.MAX_SAFE_INTEGER;
  const dateDelta = leftDate - rightDate;

  if (dateDelta !== 0) {
    return dateDelta;
  }

  return right.createdAt.localeCompare(left.createdAt);
}

export function buildDispatchQueueSections(plans: DispatchPlan[]): DispatchQueueSection[] {
  const grouped = new Map<DispatchQueueKey, DispatchPlan[]>(
    DISPATCH_QUEUE_ORDER.map((key) => [key, []]),
  );

  for (const plan of plans) {
    const group = getDispatchBoardGroup(plan.dispatchStatus);

    if (group === "other") {
      continue;
    }

    grouped.get(group)?.push(plan);
  }

  return DISPATCH_QUEUE_ORDER.map((key) => ({
    ...DISPATCH_QUEUE_META[key],
    plans: (grouped.get(key) ?? []).sort(comparePlanPriority),
  }));
}

export function getDispatchQueueMetrics(metrics: DispatchSnapshot["metrics"]) {
  return {
    active: metrics.inProgress,
    ready: metrics.readyToSchedule,
    scheduled: metrics.scheduled,
    blocked:
      metrics.awaitingMaterials +
      metrics.awaitingTechnicalReadiness +
      metrics.awaitingCustomer +
      metrics.awaitingCrew,
    total: metrics.totalPlans,
  };
}

export function sortDispatchEvents(events: DispatchEvent[]): DispatchEvent[] {
  return [...events].sort((left, right) => {
    const timestampDelta =
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();

    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

export function getCrewNameForPlan(
  assignments: CrewAssignment[],
  dispatchPlanId: string,
): string | undefined {
  return assignments.find((assignment) => assignment.dispatchPlanId === dispatchPlanId)?.crewName;
}
