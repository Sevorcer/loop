// ─── Portal Roles ─────────────────────────────────────────────────────────────

export type PortalRole =
  | "homeowner"
  | "gc"
  | "builder"
  | "property_manager";

// ─── Tenancy ──────────────────────────────────────────────────────────────────

export interface PortalOrg {
  id: string;
  name: string;
}

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  /** Memberships — one per org with associated roles and project access */
  memberships: PortalMembership[];
}

export interface PortalMembership {
  orgId: string;
  roles: PortalRole[];
  /** Explicit project IDs this membership grants access to; empty = all org projects */
  projectIds: string[];
  /** Whether the membership is currently active */
  active: boolean;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | "not_started"
  | "in_progress"
  | "inspection_pending"
  | "completed"
  | "on_hold"
  | "cancelled";

export interface PortalProject {
  id: string;
  orgId: string;
  name: string;
  address: string;
  status: ProjectStatus;
  completionPct: number;
  estimatedCompletionDate: string | null;
  nextMilestone: string | null;
  projectManager: string;
  /** ISO-8601 timestamp of last projection update */
  lastSyncedAt: string;
  /** Whether photos are enabled for external viewing on this project */
  photosEnabled: boolean;
}

// ─── Event Envelope ───────────────────────────────────────────────────────────

export interface PortalEvent {
  event_id: string;
  event_version: string;
  event_type: string;
  occurred_at: string;
  source_domain: string;
  aggregate_id: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
}

// ─── Timeline / Milestones ────────────────────────────────────────────────────

export type MilestoneStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface PortalMilestone {
  id: string;
  projectId: string;
  name: string;
  sequence: number;
  status: MilestoneStatus;
  completedAt: string | null;
  notes: string | null;
}

export interface PortalAppointment {
  id: string;
  projectId: string;
  scheduledDate: string;
  scheduledWindow: string;
  appointmentType: string;
  contactName: string;
  contactPhone: string;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocumentVisibility = "customer" | "internal";

export type DocumentType =
  | "proposal"
  | "signed_agreement"
  | "manual"
  | "warranty"
  | "inspection_report"
  | "maintenance_recommendation"
  | "other";

export interface PortalDocument {
  id: string;
  projectId: string;
  name: string;
  documentType: DocumentType;
  visibility: DocumentVisibility;
  fileSizeBytes: number;
  mimeType: string;
  publishedAt: string;
  /** Roles allowed to view this document; null = all roles with document access */
  allowedRoles: PortalRole[] | null;
}

// ─── Photos (Sprint 22B) ──────────────────────────────────────────────────────

export type PhotoCategory =
  | "before"
  | "during"
  | "completed"
  | "equipment"
  | "mechanical_room"
  | "outdoor_unit"
  | "permits";

export type PhotoVisibility = "customer" | "internal";

export interface PortalPhoto {
  id: string;
  projectId: string;
  category: PhotoCategory;
  visibility: PhotoVisibility;
  caption: string | null;
  /** Alt text for accessibility; null = fallback to caption or category label */
  altText: string | null;
  takenAt: string;
  uploadedAt: string;
  /** Placeholder URL — in production this would be a signed storage URL */
  url: string;
  thumbnailUrl: string;
  /** Roles allowed to view; null = all roles with photo access */
  allowedRoles: PortalRole[] | null;
}

// ─── Contact Team ─────────────────────────────────────────────────────────────

export type ContactRole =
  | "project_manager"
  | "office"
  | "sales_rep"
  | "emergency";

export interface PortalContact {
  id: string;
  projectId: string;
  name: string;
  role: ContactRole;
  phone: string | null;
  email: string | null;
  preferredMethod: "phone" | "email" | "text";
}

// ─── Change Orders ────────────────────────────────────────────────────────────

export interface PortalChangeOrder {
  id: string;
  projectId: string;
  changeOrderNumber: string;
  title: string;
  approvedAmountCents: number;
  currency: string;
  approvedAt: string;
  effectiveDate: string;
}

// ─── Notification Preferences (Sprint 22B) ────────────────────────────────────

export type NotificationCategory =
  | "appointment_reminder"
  | "inspection_scheduled"
  | "inspection_completed"
  | "change_order_approved"
  | "project_completed"
  | "warranty_available";

export type NotificationChannel = "email" | "sms" | "push" | "in_app";

export interface NotificationChannelPreference {
  channel: NotificationChannel;
  enabled: boolean;
}

export interface NotificationPreference {
  userId: string;
  projectId: string;
  category: NotificationCategory;
  channels: NotificationChannelPreference[];
}

// ─── Portal Permission Set ────────────────────────────────────────────────────

export interface PortalPermissions {
  canViewTimeline: boolean;
  canViewDocuments: boolean;
  canViewPhotos: boolean;
  canViewChangeOrders: boolean;
  canViewAppointments: boolean;
  canViewContact: boolean;
  canViewMilestoneDetails: boolean;
  canViewInspectionStatus: boolean;
  canViewPortfolio: boolean;
  canViewInstalledEquipment: boolean;
  canViewWarranties: boolean;
  canViewMaintenanceRecords: boolean;
  canAcknowledgeChangeOrder: boolean;
}

// ─── Portal Projection State ──────────────────────────────────────────────────

export interface PortalProjection {
  project: PortalProject;
  milestones: PortalMilestone[];
  appointments: PortalAppointment[];
  documents: PortalDocument[];
  photos: PortalPhoto[];
  contacts: PortalContact[];
  changeOrders: PortalChangeOrder[];
  /** ISO-8601 — when this projection was last rebuilt */
  lastProjectedAt: string;
}

// ─── Freshness ────────────────────────────────────────────────────────────────

export type FreshnessLevel = "fresh" | "stale" | "elevated_stale" | "unavailable";

export interface FreshnessState {
  level: FreshnessLevel;
  lastSyncedAt: string;
  minutesAgo: number;
}

// ─── Auth Result ──────────────────────────────────────────────────────────────

export type AuthzErrorCode =
  | "unauthorized"
  | "invite_expired"
  | "access_revoked"
  | "project_not_found"
  | "service_unavailable";

export interface AuthzResult {
  granted: boolean;
  errorCode: AuthzErrorCode | null;
  effectiveRoles: PortalRole[];
  permissions: PortalPermissions | null;
}
