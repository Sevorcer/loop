// =============================================================================
// GC Field Issue Request — Type System
// Sprint 27 — #57
//
// Field-initiated issue reports submitted by technicians and GC staff.
// Routed to a dispatcher/admin queue for triage and resolution.
// =============================================================================

// ─── Priority ─────────────────────────────────────────────────────────────────

export type GcIssuePriority = "low" | "medium" | "high" | "critical";

// ─── Status ───────────────────────────────────────────────────────────────────

export type GcIssueStatus =
  | "open"
  | "triaged"
  | "in_progress"
  | "resolved"
  | "closed";

// ─── Aggregate root ───────────────────────────────────────────────────────────

export interface GcIssueRequest {
  id: string;
  orgId: string;
  title: string;
  description: string;
  priority: GcIssuePriority;
  status: GcIssueStatus;
  /** Optional reference to a property */
  propertyId: string | null;
  /** Optional reference to a job */
  jobId: string | null;
  /** Internal user who submitted the request */
  submittedBy: string | null;
  /** Dispatcher/admin assigned for resolution */
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Attached storage object IDs (join table, loaded separately) */
  attachmentIds?: string[];
}

// ─── Write inputs ─────────────────────────────────────────────────────────────

export interface CreateGcIssueRequestInput {
  title: string;
  description: string;
  priority: GcIssuePriority;
  propertyId?: string;
  jobId?: string;
  /** storage_object IDs to attach */
  attachmentIds?: string[];
}

export interface UpdateGcIssueRequestInput {
  title?: string;
  description?: string;
  priority?: GcIssuePriority;
  status?: GcIssueStatus;
  propertyId?: string | null;
  jobId?: string | null;
  assignedTo?: string | null;
  resolvedAt?: string | null;
}

// ─── Status transition map ────────────────────────────────────────────────────
// Defines allowed next-state transitions for status machine enforcement.

export const ISSUE_STATUS_TRANSITIONS: Record<GcIssueStatus, GcIssueStatus[]> = {
  open:        ["triaged", "closed"],
  triaged:     ["in_progress", "closed"],
  in_progress: ["resolved", "closed"],
  resolved:    ["closed"],
  closed:      [],
};
