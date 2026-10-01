// ============================================================
// Dispatch — Type System
// Sprint 19
//
// Dispatch is the operational coordinator that turns ready work
// into executable schedules.
//
// Core question: "Who should do the work, when should it happen,
// and what must be true before dispatch?"
//
// Domain model:
//   Job → DispatchPlan → CrewAssignment → ScheduleBlock → DispatchEvents
//
// DispatchPlan is the aggregate root. All dispatch objects reference it.
// ============================================================

// ------------------------------------------------------------------
// Dispatchability Readiness Inputs
// Dispatch consumes readiness from four domains — it does not own them.
// ------------------------------------------------------------------

export type ReadinessState = "satisfied" | "attention_needed" | "not_satisfied";

/**
 * Readiness from the Inventory domain.
 * Answers: do we have the required materials reserved and loaded?
 */
export interface MaterialReadinessInput {
  state: ReadinessState;
  /** Human-readable reason — for display only */
  reason: string;
}

/**
 * Readiness from the Installed Systems domain.
 * Answers: is the technical truth complete enough to perform the work?
 */
export interface TechnicalReadinessInput {
  state: ReadinessState;
  reason: string;
}

/**
 * Customer readiness: is the customer confirmed for execution?
 */
export interface CustomerReadinessInput {
  state: ReadinessState;
  reason: string;
}

/**
 * Crew readiness: is a qualified crew available for this work?
 */
export interface CrewReadinessInput {
  state: ReadinessState;
  reason: string;
}

/**
 * Dispatchability — derived from the four readiness inputs.
 * This is a first-class operational concept in LOOP.
 *
 * A job becomes dispatchable only when all four conditions are satisfied.
 */
export interface Dispatchability {
  isDispatchable: boolean;
  materialReadiness: MaterialReadinessInput;
  technicalReadiness: TechnicalReadinessInput;
  customerReadiness: CustomerReadinessInput;
  crewReadiness: CrewReadinessInput;
}

// ------------------------------------------------------------------
// Dispatch Status
// Explains why work is or is not moving. Not arbitrary labels.
// ------------------------------------------------------------------

export type DispatchStatus =
  /** All readiness inputs satisfied — job can be placed on the schedule */
  | "ready_to_schedule"
  /** Material readiness is not satisfied */
  | "awaiting_materials"
  /** Technical truth is incomplete or unresolved */
  | "awaiting_technical_readiness"
  /** Customer has not confirmed execution */
  | "awaiting_customer_confirmation"
  /** Job is ready but no suitable crew is currently available */
  | "awaiting_crew_availability"
  /** Dispatch Plan exists and has schedule placement */
  | "scheduled"
  /** Work has begun */
  | "in_progress"
  /** Work is complete */
  | "completed";

// ------------------------------------------------------------------
// Scheduling Priority
// ------------------------------------------------------------------

export type DispatchPriority = "urgent" | "high" | "normal" | "low";

// ------------------------------------------------------------------
// Dispatch Plan — Aggregate Root
// The canonical object that coordinates dispatch truth for a job.
// All other dispatch objects (CrewAssignment, ScheduleBlock, DispatchEvent)
// reference the Dispatch Plan rather than becoming separate sources of truth.
// ------------------------------------------------------------------

export interface DispatchPlan {
  id: string;
  jobId: string;
  jobNumber: string;
  /** Job title from the jobs table (enriched at snapshot load). */
  jobTitle?: string; assignedTechNames?: string[];
  customerName: string;
  propertyName: string;
  jobType: string;

  /** Current operational state */
  dispatchStatus: DispatchStatus;

  /** Computed from four readiness inputs */
  dispatchability: Dispatchability;

  /** Target execution date (ISO date string) */
  targetDate: string;

  /**
   * PR3C: Real clock-time committed start from the associated job.
   * ISO 8601 timestamptz. Replaces the old appointmentWindow Morning/Afternoon labels.
   */
  scheduledStartAt?: string | null;

  /**
   * @deprecated Use scheduledStartAt. Kept for one release window.
   * Appointment window from the associated job (Morning or Afternoon).
   * TODO(cleanup): Remove after migration 20260729000003 is stable everywhere.
   */
  appointmentWindow?: "Morning" | "Afternoon";

  /** Estimated hours on site */
  estimatedDurationHours: number;

  priority: DispatchPriority;

  /** Human-readable sequencing intent: what should happen first, dependencies */
  sequencingNotes?: string;

  /** Known scheduling constraints (permits, access windows, etc.) */
  constraints: DispatchConstraint[];

  /** ISO timestamp when this plan was created */
  createdAt: string;

  /** ISO timestamp of most recent change */
  updatedAt: string;
}

export interface DispatchConstraint {
  label: string;
  severity: "blocking" | "warning" | "note";
}

// ------------------------------------------------------------------
// Crew — referenced by Dispatch, not owned by it.
// Dispatch references crew records; it does not own crew identity.
// ------------------------------------------------------------------

export type CrewAvailability =
  | "available"
  | "partially_available"
  | "unavailable"
  | "on_job";

export interface CrewMember {
  id: string;
  name: string;
  role: "lead" | "installer" | "apprentice" | "helper";
}

export interface Crew {
  id: string;
  name: string;
  leadInstaller: string;
  members: CrewMember[];
  certifications: string[];
  availability: CrewAvailability;
  truckName: string;
}

// ------------------------------------------------------------------
// Crew Assignment
// References the Dispatch Plan rather than becoming a separate source of truth.
// ------------------------------------------------------------------

export type AssignmentStatus =
  | "proposed"
  | "confirmed"
  | "dispatched"
  | "reassigned"
  | "released";

export interface ReassignmentRecord {
  previousCrewId: string;
  previousCrewName: string;
  reassignedAt: string;
  reason: string;
}

export interface CrewAssignment {
  id: string;
  /** The aggregate root — all assignments reference a Dispatch Plan */
  dispatchPlanId: string;
  jobId: string;
  crewId: string;
  crewName: string;
  leadInstaller: string;
  supportingTechnicians: string[];
  status: AssignmentStatus;
  assignedAt: string;
  reassignmentHistory: ReassignmentRecord[];
}

// ------------------------------------------------------------------
// Schedule Block
// The planned execution window derived from the Dispatch Plan.
// It is NOT the job, NOT the source of truth — it is the rendering artifact
// that the calendar and crew schedule views consume.
// ------------------------------------------------------------------

export interface ScheduleBlock {
  id: string;
  /** References the aggregate root */
  dispatchPlanId: string;
  jobId: string;
  crewAssignmentId: string;
  crewName: string;
  scheduledDate: string;
  /** 24-hour format: "08:00" */
  scheduledStartTime: string;
  /** 24-hour format: "16:00" */
  scheduledEndTime: string;
  estimatedDurationHours: number;
  jobType: string;
  customerName: string;
  propertyName: string;
  dispatchStatus: DispatchStatus;
  /**
   * PR3C: Real clock-time committed start from the associated job.
   * ISO 8601 timestamptz.
   */
  scheduledStartAt?: string | null;
  /**
   * @deprecated Use scheduledStartAt.
   * TODO(cleanup): Remove after migration 20260729000003 is stable everywhere.
   */
  appointmentWindow?: "Morning" | "Afternoon";
}

// ------------------------------------------------------------------
// Dispatch Events
// Dispatch should emit facts it owns, not operational facts from other domains.
//
// Good: JobScheduled, CrewAssigned, ScheduleChanged, CrewDispatched, JobRescheduled
// Not Dispatch's to emit: MaterialsReserved, PermitApproved, TechnicalProfileUpdated
// ------------------------------------------------------------------

export type DispatchEventType =
  | "job_scheduled"
  | "crew_assigned"
  | "schedule_changed"
  | "crew_dispatched"
  | "job_rescheduled"
  | "crew_delayed"
  | "dispatch_plan_created";

export interface DispatchEvent {
  id: string;
  /** References the aggregate root */
  dispatchPlanId: string;
  type: DispatchEventType;
  /** ISO timestamp */
  timestamp: string;
  /** Human-readable details */
  description: string;
  /** For reassignments and reschedules */
  metadata?: Record<string, string>;
}

// ------------------------------------------------------------------
// Dispatch Snapshot — assembled result passed to DispatchScreen
// ------------------------------------------------------------------

export interface DispatchSnapshot {
  dispatchPlans: DispatchPlan[];
  crewAssignments: CrewAssignment[];
  scheduleBlocks: ScheduleBlock[];
  dispatchEvents: DispatchEvent[];
  crews: Crew[];
  /** Job-level context for board filters (contractor filter). Loaded with the snapshot. */
  contractors?: { id: string; name: string }[];
  jobContractorIds?: Record<string, string[]>;
  metrics: {
    readyToSchedule: number;
    scheduled: number;
    inProgress: number;
    awaitingMaterials: number;
    awaitingTechnicalReadiness: number;
    awaitingCustomer: number;
    awaitingCrew: number;
    totalPlans: number;
  };
}
