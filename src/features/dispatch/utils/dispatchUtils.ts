// ============================================================
// Dispatch — Derivation Utils
// Sprint 19
//
// All snapshot views are derived from core domain objects.
// No component computes dispatchability or schedule state independently.
// ============================================================

import type {
  Crew,
  CrewAssignment,
  DispatchEvent,
  DispatchPlan,
  DispatchSnapshot,
  DispatchStatus,
  Dispatchability,
  ScheduleBlock,
} from "../types/dispatch";

// ------------------------------------------------------------------
// Dispatchability Derivation
// Derives whether a job is operationally ready to be scheduled.
// A job is dispatchable only when all four readiness inputs are satisfied.
// ------------------------------------------------------------------

export function deriveIsDispatchable(dispatchability: Dispatchability): boolean {
  return (
    dispatchability.materialReadiness.state === "satisfied" &&
    dispatchability.technicalReadiness.state === "satisfied" &&
    dispatchability.customerReadiness.state === "satisfied" &&
    dispatchability.crewReadiness.state === "satisfied"
  );
}

// ------------------------------------------------------------------
// Dispatch Status Label
// Human-readable explanation of why work is or is not moving.
// ------------------------------------------------------------------

export function getDispatchStatusLabel(status: DispatchStatus): string {
  switch (status) {
    case "ready_to_schedule":
      return "Ready to Schedule";
    case "awaiting_materials":
      return "Awaiting Materials";
    case "awaiting_technical_readiness":
      return "Awaiting Technical Readiness";
    case "awaiting_customer_confirmation":
      return "Awaiting Customer Confirmation";
    case "awaiting_crew_availability": return "Awaiting Crew Availability";
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In Progress"; case "on_hold": return "On Hold";
    case "completed":
      return "Completed"; case "cancelled": return "Cancelled";
  }
}

export function getDispatchEventLabel(type: DispatchEvent["type"]): string {
  switch (type) {
    case "job_scheduled":
      return "Job Scheduled";
    case "crew_assigned":
      return "Crew Assigned";
    case "schedule_changed":
      return "Schedule Changed";
    case "crew_dispatched":
      return "Crew Dispatched";
    case "job_rescheduled":
      return "Job Rescheduled";
    case "crew_delayed":
      return "Crew Delayed";
    case "dispatch_plan_created":
      return "Plan Created";
  }
}

// ------------------------------------------------------------------
// Board grouping helpers
// Used to drive the Dispatch Board views.
// ------------------------------------------------------------------

export function getDispatchBoardGroup(
  status: DispatchStatus
): "ready" | "scheduled" | "blocked" | "active" | "other" {
  switch (status) {
    case "ready_to_schedule":
      return "ready";
    case "scheduled":
      return "scheduled";
    case "in_progress":
      return "active";
    case "awaiting_materials":
    case "awaiting_technical_readiness":
    case "awaiting_customer_confirmation":
    case "awaiting_crew_availability": case "on_hold":
      return "blocked";
    case "completed":
      return "other";
  }
}

// ------------------------------------------------------------------
// Snapshot Assembly
// ------------------------------------------------------------------

export function assembleDispatchSnapshot(
  plans: DispatchPlan[],
  crewAssignments: CrewAssignment[],
  scheduleBlocks: ScheduleBlock[],
  dispatchEvents: DispatchEvent[],
  crews: Crew[]
): DispatchSnapshot {
  const metrics = {
    totalPlans: plans.length,
    readyToSchedule: plans.filter(
      (p) => p.dispatchStatus === "ready_to_schedule"
    ).length,
    scheduled: plans.filter((p) => p.dispatchStatus === "scheduled").length,
    inProgress: plans.filter((p) => p.dispatchStatus === "in_progress").length,
    awaitingMaterials: plans.filter(
      (p) => p.dispatchStatus === "awaiting_materials"
    ).length,
    awaitingTechnicalReadiness: plans.filter(
      (p) => p.dispatchStatus === "awaiting_technical_readiness"
    ).length,
    awaitingCustomer: plans.filter(
      (p) => p.dispatchStatus === "awaiting_customer_confirmation"
    ).length,
    awaitingCrew: plans.filter(
      (p) => p.dispatchStatus === "awaiting_crew_availability"
    ).length,
  };

  return {
    dispatchPlans: plans,
    crewAssignments,
    scheduleBlocks,
    dispatchEvents,
    crews,
    metrics,
  };
}

// ------------------------------------------------------------------
// Schedule Block Helpers
// ------------------------------------------------------------------

export function getScheduleBlocksForCrew(
  scheduleBlocks: ScheduleBlock[],
  crewName: string
): ScheduleBlock[] {
  return scheduleBlocks.filter((block) => block.crewName === crewName);
}

export function getScheduleBlocksForDate(
  scheduleBlocks: ScheduleBlock[],
  date: string
): ScheduleBlock[] {
  return scheduleBlocks.filter((block) => block.scheduledDate === date);
}

export function getCrewAssignmentForPlan(
  assignments: CrewAssignment[],
  dispatchPlanId: string
): CrewAssignment | undefined {
  return assignments.find((a) => a.dispatchPlanId === dispatchPlanId);
}

export function getEventsForPlan(
  events: DispatchEvent[],
  dispatchPlanId: string
): DispatchEvent[] {
  return events.filter((e) => e.dispatchPlanId === dispatchPlanId);
}

// ------------------------------------------------------------------
// Format helpers
// ------------------------------------------------------------------

export function formatScheduleTime(time24: string): string {
  const [hourStr, minute] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute} ${ampm}`;
}

export function formatTargetDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate ?? "";
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Returns today's date as an ISO date string (YYYY-MM-DD) in local time.
 * Used to filter schedule blocks and plans for today's view.
 */
export function getLocalTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Filters dispatch plans by their targetDate.
 * Returns all plans when date is empty string or undefined.
 */
export function filterPlansByDate(
  plans: DispatchPlan[],
  date: string,
): DispatchPlan[] {
  if (!date) return plans;
  return plans.filter((plan) => plan.targetDate === date);
}

/**
 * Returns a human-readable label for a job appointment window.
 * Safe to call with undefined (returns empty string).
 */
export function getAppointmentWindowLabel(
  window: "Morning" | "Afternoon" | undefined,
): string {
  if (!window) return "";
  return window === "Morning" ? "Morning" : "Afternoon";
}
