import type { ScheduleBlock } from "../types/dispatch";

/**
 * Mock schedule blocks for Sprint 19.
 * Schedule blocks are derived from Dispatch Plans — they are the calendar
 * rendering artifact, not the source of truth.
 * Each block references its dispatchPlanId (aggregate root).
 */
export const mockScheduleBlocks: ScheduleBlock[] = [
  // JOB-1001 — Smith Residence — Monday July 21, Marcus Rivera
  {
    id: "sb-001",
    dispatchPlanId: "dp-001",
    jobId: "job-001",
    crewAssignmentId: "ca-001",
    crewName: "Rivera Install Crew",
    scheduledDate: "2026-07-21",
    scheduledStartTime: "07:00",
    scheduledEndTime: "15:30",
    estimatedDurationHours: 8,
    jobType: "Install",
    customerName: "John Smith",
    propertyName: "Smith Residence",
    dispatchStatus: "scheduled",
  },

  // JOB-1007 — Metro Station B — Today July 19, Jordan Lee (in progress)
  {
    id: "sb-002",
    dispatchPlanId: "dp-006",
    jobId: "job-007",
    crewAssignmentId: "ca-002",
    crewName: "Lee Commercial Crew",
    scheduledDate: "2026-07-19",
    scheduledStartTime: "07:15",
    scheduledEndTime: "11:45",
    estimatedDurationHours: 4.5,
    jobType: "Commercial Service",
    customerName: "Metro Transit Authority",
    propertyName: "Metro Station B",
    dispatchStatus: "in_progress",
  },
];
