export type PortalSourceDomain =
  | "jobs"
  | "daily-plans"
  | "dispatch"
  | "installed-systems"
  | "documents"
  | "photos"
  | "change-orders"
  | "reporting";

export type PortalProjectionFreshnessState =
  | "fresh"
  | "stale"
  | "critical"
  | "disrupted";

export type PortalDocumentVisibility = "customer" | "draft" | "internal";

export interface PortalProjectOverview {
  projectId: string;
  title: string;
  customerName: string;
  propertyName: string;
  status: string;
  completionPercent: number;
  estimatedCompletionDate?: string;
  nextMilestone?: string;
  assignedProjectManager?: string;
  lastUpdated?: string;
}

export interface PortalTimelineEntry {
  id: string;
  eventType: string;
  label: string;
  occurredAt: string;
  sourceDomain: PortalSourceDomain;
  summary?: string;
}

export interface PortalAppointmentSummary {
  id: string;
  source: PortalSourceDomain;
  scheduledDate: string;
  scheduledWindow: string;
  type: string;
  contactName?: string;
}

export interface PortalPublishedDocument {
  id: string;
  title: string;
  category: string;
  visibility: PortalDocumentVisibility;
  publishedAt: string;
  downloadUrl?: string;
}

export interface PortalPublishedPhoto {
  id: string;
  caption: string;
  uploadedAt: string;
  customerVisible: boolean;
}

export interface PortalApprovedChangeOrder {
  id: string;
  title: string;
  status: "approved";
  approvedAmountCents: number;
  currency: string;
  approvedAt: string;
}

export interface PortalInstalledSystemSummary {
  id: string;
  systemName: string;
  lifecycleStatus: string;
  installDate: string;
  permitReady: boolean;
}

export interface PortalMetricSummary {
  id: string;
  label: string;
  value: number;
  unit: string;
  trend: string;
  generatedAt: string;
}

export interface PortalProjectionState {
  projectId: string;
  overview: PortalProjectOverview;
  timeline: PortalTimelineEntry[];
  appointments: PortalAppointmentSummary[];
  documents: PortalPublishedDocument[];
  photos: PortalPublishedPhoto[];
  changeOrders: PortalApprovedChangeOrder[];
  installedSystems: PortalInstalledSystemSummary[];
  metrics: PortalMetricSummary[];
  lastEventAt?: string;
  lastSynchronizedAt?: string;
  sourceDomains: PortalSourceDomain[];
}

export interface PortalProjectionCheckpoint {
  projectId: string;
  version: number;
  capturedAt: string;
  state: PortalProjectionState;
  lastProcessedEventId?: string;
  lastProcessedIdempotencyKey?: string;
}

export interface PortalFreshnessStatus {
  state: PortalProjectionFreshnessState;
  ageMinutes: number;
  message: string;
  lastSynchronizedAt?: string;
}
