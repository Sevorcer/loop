import type {
  CrewAssignment,
  DispatchEvent,
  DispatchPlan,
  DispatchSnapshot,
} from "../types/dispatch";
import { getDispatchBoardGroup } from "./dispatchUtils";

type DispatchQueueKey = "active" | "ready" | "scheduled" | "blocked" | "completed";

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
  "completed",
];

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
    description: "Work with people and a date already committed.",
  },
  blocked: {
    key: "blocked",
    label: "Blocked",
    description: "Work waiting on readiness, the customer, people, or materials.",
  },
  completed: {
    key: "completed",
    label: "Completed",
    description: "Work finished today that should stay visible on the board.",
  },
};

/** Queue order: soonest target date, then newest created. Priority ignored (Option C). */
function comparePlanByDate(left: DispatchPlan, right: DispatchPlan) {
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
    plans: (grouped.get(key) ?? []).sort(comparePlanByDate),
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

export function getAssignedCrewLabelForPlan(plan: DispatchPlan, assignments: CrewAssignment[]): string | undefined {
  const crew = getCrewNameForPlan(assignments, plan.id);
  const names = (plan.assignedTechNames ?? []).map((name) => name.trim()).filter((name) => name.length > 0);
  if (crew && names.length > 0 && !names.includes(crew)) {
    return `${crew} · ${names.join(", ")}`;
  }
  if (crew) return crew;
  if (names.length > 0) return names.join(", ");
  return undefined;
}

export function getCrewNameForPlan(
  assignments: CrewAssignment[],
  dispatchPlanId: string,
): string | undefined {
  return assignments.find((assignment) => assignment.dispatchPlanId === dispatchPlanId)?.crewName;
}
