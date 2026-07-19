// ============================================================
// Live Operations — Type System
// Sprint 16
//
// The operational event model is the shared source of truth.
// Hero metrics, decision feed, needs-attention, timeline, and
// health are all derived from OperationalEvent[].
// ============================================================

// ------------------------------------------------------------------
// Event Model
// ------------------------------------------------------------------

export type OperationalEventType =
  | "operations_started"
  | "crew_dispatched"
  | "crew_en_route"
  | "crew_arrived"
  | "milestone_advanced"
  | "customer_delay"
  | "material_delivered"
  | "permit_issue"
  | "eta_slip"
  | "crew_delayed"
  | "blocker_resolved"
  | "job_completed"
  // Inventory domain events — observed by Live Operations, owned by Inventory
  | "materials_reserved"
  | "parts_picked"
  | "truck_loaded"
  | "missing_equipment"
  | "backorder_created"
  | "emergency_part_delivered";

export type EventSeverity = "info" | "warning" | "critical";

export interface OperationalEvent {
  id: string;
  type: OperationalEventType;
  /** ISO timestamp */
  timestamp: string;
  /** Human-readable clock label, e.g. "8:02 AM" */
  timeLabel: string;
  sourceType: "crew" | "work_order" | "system";
  sourceId: string;
  severity: EventSeverity;
  title: string;
  description: string;
  relatedWorkOrderId?: string;
  relatedCrewId?: string;
  /**
   * For `milestone_advanced` events, the explicit next milestone.
   * Prefer this over title-string matching in derivation.
   */
  newMilestone?: WorkOrderMilestone;
  /** Shown in Decision Feed and Needs Attention as the suggested next step */
  actionRecommendation?: string;
  /** If true, this event surfaces in the Decision Feed */
  requiresDecision?: boolean;
  /** Named options the manager can choose from (Decision Feed) */
  decisionOptions?: string[];
  /**
   * If true, this event no longer appears in Needs Attention or Decision Feed.
   * A subsequent event should mark the original as resolved.
   */
  resolved?: boolean;
}

// ------------------------------------------------------------------
// Crew Operational State
// Derived from the last relevant event(s) for each crew.
// ------------------------------------------------------------------

export type CrewOperationalState =
  | "dispatched"
  | "traveling"
  | "on_site"
  | "working"
  | "delayed"
  | "available"
  | "standby";

export interface LiveCrewCard {
  crewId: string;
  crewName: string;
  technician: string;
  workOrderId: string | null;
  customer: string | null;
  currentMilestone: WorkOrderMilestone | null;
  minutesInMilestone: number;
  eta: string | null;
  operationalState: CrewOperationalState;
  hasBlocker: boolean;
  blockerLabel: string | null;
}

// ------------------------------------------------------------------
// Work Order Milestone State
// Derived from the last milestone_advanced / crew_arrived events.
// ------------------------------------------------------------------

export type WorkOrderMilestone =
  | "assigned"
  | "en_route"
  | "arrived"
  | "working"
  | "quality_check"
  | "complete";

export const MILESTONE_LABELS: Record<WorkOrderMilestone, string> = {
  assigned: "Assigned",
  en_route: "En Route",
  arrived: "Arrived",
  working: "Working",
  quality_check: "Quality Check",
  complete: "Complete",
};

export const MILESTONE_ORDER: WorkOrderMilestone[] = [
  "assigned",
  "en_route",
  "arrived",
  "working",
  "quality_check",
  "complete",
];

export interface LiveWorkOrder {
  id: string;
  jobNumber: string;
  customer: string;
  address: string;
  description: string;
  milestone: WorkOrderMilestone;
  minutesInMilestone: number;
  assignedCrewId: string;
  assignedCrewName: string;
  estimatedHours: number;
  isBlocked: boolean;
  blockerLabel: string | null;
}

// ------------------------------------------------------------------
// Derived Views
// Each is produced by a derivation function in liveOpsUtils.ts.
// ------------------------------------------------------------------

/** Aggregated counts displayed in the Operations Overview Hero */
export interface LiveOpsHeroMetrics {
  activeCrews: number;
  jobsRunning: number;
  /** Unresolved warning + critical events that represent time/schedule disruptions */
  delays: number;
  /** Unresolved critical events */
  criticalIssues: number;
  lastEventTimeLabel: string | null;
}

export type HealthState = "healthy" | "minor_issues" | "needs_attention" | "critical";

export interface OperationalHealthSummary {
  state: HealthState;
  label: string;
  /** Plain-language reasons; derived directly from unresolved event counts */
  reasons: string[];
}

// ------------------------------------------------------------------
// Seed types used by mock data only
// ------------------------------------------------------------------

export interface InitialCrewSeed {
  crewId: string;
  crewName: string;
  technician: string;
}

export interface InitialWorkOrderSeed {
  id: string;
  jobNumber: string;
  customer: string;
  address: string;
  description: string;
  assignedCrewId: string;
  assignedCrewName: string;
  estimatedHours: number;
}

// ------------------------------------------------------------------
// Snapshot — the assembled result passed to LiveOperationsScreen
// ------------------------------------------------------------------

export interface LiveOpsSnapshot {
  date: string;
  startedAt: string;
  heroMetrics: LiveOpsHeroMetrics;
  health: OperationalHealthSummary;
  crews: LiveCrewCard[];
  workOrders: LiveWorkOrder[];
  /** Full chronological event stream (for timeline) */
  events: OperationalEvent[];
  /** Unresolved events where requiresDecision === true */
  decisions: OperationalEvent[];
  /** Unresolved warning + critical events */
  attention: OperationalEvent[];
}
