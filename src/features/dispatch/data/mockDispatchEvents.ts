import type { DispatchEvent } from "../types/dispatch";

/**
 * Mock dispatch events for Sprint 19.
 * Dispatch emits facts it owns: scheduling, crew assignment, rescheduling.
 * It does not emit facts owned by other domains (materials, permits, etc.).
 */
export const mockDispatchEvents: DispatchEvent[] = [
  // DP-006 — Metro Station B
  {
    id: "de-001",
    dispatchPlanId: "dp-006",
    type: "dispatch_plan_created",
    timestamp: "2026-07-18T17:00:00Z",
    description: "Dispatch plan created for JOB-1007 — Metro Station B.",
  },
  {
    id: "de-002",
    dispatchPlanId: "dp-006",
    type: "crew_assigned",
    timestamp: "2026-07-18T17:30:00Z",
    description: "Jordan Lee crew assigned to Metro Station B service call.",
  },
  {
    id: "de-003",
    dispatchPlanId: "dp-006",
    type: "job_scheduled",
    timestamp: "2026-07-18T17:32:00Z",
    description: "JOB-1007 scheduled for July 19, 7:15 AM–11:45 AM.",
  },
  {
    id: "de-004",
    dispatchPlanId: "dp-006",
    type: "crew_dispatched",
    timestamp: "2026-07-19T07:15:00Z",
    description: "Jordan Lee crew dispatched to Metro Station B.",
  },

  // DP-001 — Smith Residence
  {
    id: "de-005",
    dispatchPlanId: "dp-001",
    type: "dispatch_plan_created",
    timestamp: "2026-07-18T14:30:00Z",
    description: "Dispatch plan created for JOB-1001 — Smith Residence.",
  },
  {
    id: "de-006",
    dispatchPlanId: "dp-001",
    type: "crew_assigned",
    timestamp: "2026-07-18T16:00:00Z",
    description: "Marcus Rivera crew assigned to Smith Residence install.",
  },
  {
    id: "de-007",
    dispatchPlanId: "dp-001",
    type: "job_scheduled",
    timestamp: "2026-07-18T16:05:00Z",
    description: "JOB-1001 scheduled for July 21, 7:00 AM–3:30 PM.",
  },

  // DP-003 — Clearwater (originally July 20, rescheduled due to backorder)
  {
    id: "de-008",
    dispatchPlanId: "dp-003",
    type: "dispatch_plan_created",
    timestamp: "2026-07-18T16:00:00Z",
    description: "Dispatch plan created for JOB-1015 — Clearwater Building C.",
  },
  {
    id: "de-009",
    dispatchPlanId: "dp-003",
    type: "job_rescheduled",
    timestamp: "2026-07-18T16:10:00Z",
    description: "JOB-1015 rescheduled to July 28 — Carrier rooftop unit backordered.",
    metadata: {
      previousDate: "2026-07-20",
      newDate: "2026-07-28",
      reason: "Material backorder",
    },
  },
];
