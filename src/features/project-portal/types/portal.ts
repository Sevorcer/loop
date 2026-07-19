// ============================================================
// Project Portal — Type System
// Sprint 22A
//
// The Project Portal is a read-only, role-aware projection of
// project state for external stakeholders. It never owns data;
// it reflects trusted events from operational domains.
//
// Core model:
//   EventEnvelope → EventProjection → PortalViewModels
//   PortalUser → PortalRole[] → PermissionSet
// ============================================================

// ─── Roles ───────────────────────────────────────────────────────────────────

/**
 * MVP roles available in Sprint 22.
 * Office and InternalAdmin are reserved for future sprints.
 */
export type PortalRole =
  | "homeowner"
  | "general_contractor"
  | "builder_developer"
  | "property_manager";

// ─── Tenancy ─────────────────────────────────────────────────────────────────

export interface PortalOrgMembership {
  organizationId: string;
  organizationName: string;
  roles: PortalRole[];
  /** ISO-8601. null means active (no expiry). */
  inviteExpiresAt: string | null;
  /** Whether the organization admin has explicitly revoked this membership. */
  isRevoked: boolean;
}

export interface PortalUser {
  id: string;
  displayName: string;
  email: string;
  memberships: PortalOrgMembership[];
}

// ─── Permission Set ───────────────────────────────────────────────────────────

/**
 * Resolved permissions for a user in a specific organization context.
 * Computed by the authorization layer — never stored or trusted from client.
 */
export interface PortalPermissionSet {
  canViewOverview: boolean;
  canViewTimeline: boolean;
  canViewDocuments: boolean;
  canDownloadDocuments: boolean;
  canViewPhotos: boolean;
  canViewChangeOrders: boolean;
  canViewAppointments: boolean;
  canViewContactTeam: boolean;
  canViewMilestoneDetails: boolean;
  canViewInspectionStatus: boolean;
  canViewPortfolio: boolean;
  canViewInstalledEquipment: boolean;
  canViewWarrantyRecords: boolean;
  canViewMaintenanceRecords: boolean;
  canViewServiceHistory: boolean;
  /** Always false for all external roles. */
  canViewInternalData: boolean;
}

// ─── Authorization Result ─────────────────────────────────────────────────────

export type AuthorizationErrorCode =
  | "unauthorized"
  | "expired_invite"
  | "revoked_access"
  | "missing_project"
  | "stale_feed"
  | "service_unavailable";

export type AuthorizationResult =
  | { ok: true; permissionSet: PortalPermissionSet; resolvedRoles: PortalRole[] }
  | { ok: false; errorCode: AuthorizationErrorCode };

// ─── Event Envelope ───────────────────────────────────────────────────────────

/**
 * Canonical event envelope for all portal projection events.
 * Per event-contract-spec.md v1.0.
 *
 * The portal never writes events — it only reads them.
 */
export interface PortalEventEnvelope<P = unknown> {
  event_id: string;
  event_version: string;
  event_type: PortalEventType;
  occurred_at: string;
  source_domain: PortalSourceDomain;
  aggregate_id: string;
  idempotency_key: string;
  payload: P;
}

export type PortalSourceDomain =
  | "jobs"
  | "dispatch"
  | "daily-plans"
  | "documents"
  | "photos"
  | "change-orders"
  | "installed-systems";

export type PortalEventType =
  | "milestone.completed"
  | "inspection.scheduled"
  | "inspection.completed"
  | "appointment.scheduled"
  | "appointment.updated"
  | "crew.dispatched"
  | "crew.arrived"
  | "installation.completed"
  | "startup.completed"
  | "change_order.approved"
  | "document.published"
  | "photo.uploaded";

// ─── Event Payloads ───────────────────────────────────────────────────────────

export interface MilestoneCompletedPayload {
  milestone_id: string;
  milestone_name: string;
  milestone_sequence: number;
  completed_by: string;
  notes_for_portal: string;
  project_id: string;
}

export interface AppointmentScheduledPayload {
  appointment_id: string;
  project_id: string;
  scheduled_date: string;
  scheduled_window: string;
  appointment_type: string;
  contact_name: string;
  contact_phone: string;
}

export interface ChangeOrderApprovedPayload {
  change_order_id: string;
  project_id: string;
  change_order_number: string;
  title: string;
  approved_amount_cents: number;
  currency: string;
  approved_at: string;
  effective_date: string;
}

export interface DocumentPublishedPayload {
  document_id: string;
  project_id: string;
  document_name: string;
  document_type: string;
  /** "customer" | "internal" — portal only processes "customer" visibility */
  visibility: "customer" | "internal";
  file_size_bytes: number;
  mime_type: string;
  published_at: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | "not_started"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export interface PortalProject {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  status: ProjectStatus;
  completionPercent: number;
  estimatedCompletionDate: string;
  nextMilestone: string | null;
  projectManagerName: string;
  projectManagerPhone: string;
  projectManagerEmail: string;
  createdAt: string;
}

// ─── Portal View Models ───────────────────────────────────────────────────────

/**
 * Derived overview for a single project.
 */
export interface ProjectOverviewViewModel {
  project: PortalProject;
  lastSynchronizedAt: string;
}

/**
 * A single timeline entry derived from a milestone.completed event.
 */
export interface TimelineEntry {
  id: string;
  milestoneId: string;
  milestoneName: string;
  milestoneSequence: number;
  completedAt: string;
  completedBy: string;
  notesForPortal: string;
}

export interface TimelineViewModel {
  projectId: string;
  entries: TimelineEntry[];
  lastSynchronizedAt: string;
}

/**
 * A customer-visible document.
 */
export interface PortalDocument {
  id: string;
  name: string;
  documentType: string;
  fileSizeBytes: number;
  mimeType: string;
  publishedAt: string;
  /** Always "customer" — internal docs are never in this model */
  visibility: "customer";
}

export interface DocumentsViewModel {
  projectId: string;
  documents: PortalDocument[];
  lastSynchronizedAt: string;
}

/**
 * An upcoming appointment shown in the portal.
 */
export interface PortalAppointment {
  id: string;
  scheduledDate: string;
  scheduledWindow: string;
  appointmentType: string;
  contactName: string;
  contactPhone: string;
}

/**
 * An approved change order visible in the portal.
 */
export interface PortalChangeOrder {
  id: string;
  changeOrderNumber: string;
  title: string;
  approvedAmountCents: number;
  currency: string;
  approvedAt: string;
  effectiveDate: string;
}

// ─── Contact Team ─────────────────────────────────────────────────────────────

export interface ContactTeamEntry {
  role: string;
  name: string;
  phone: string;
  email: string;
}

export interface ContactTeamViewModel {
  projectId: string;
  contacts: ContactTeamEntry[];
}

// ─── Freshness / Stale State ──────────────────────────────────────────────────

export type FreshnessState = "fresh" | "stale_warning" | "stale_elevated" | "unavailable";

export interface FreshnessStatus {
  state: FreshnessState;
  lastSynchronizedAt: string;
  minutesSinceSync: number;
}

// ─── Portal State ─────────────────────────────────────────────────────────────

export type PortalLoadState = "loading" | "error" | "success";

export interface PortalProjection {
  project: PortalProject | null;
  timeline: TimelineViewModel | null;
  documents: DocumentsViewModel | null;
  appointments: PortalAppointment[];
  changeOrders: PortalChangeOrder[];
  contactTeam: ContactTeamViewModel | null;
  freshness: FreshnessStatus;
}
