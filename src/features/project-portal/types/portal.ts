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

export interface PortalAppointment {
  id: string;
  source: PortalSourceDomain;
  scheduledDate: string;
  scheduledWindow: string;
  type: string;
  contactName?: string;
}

export interface PortalDocument {
  id: string;
  title: string;
  category: string;
  visibility: PortalDocumentVisibility;
  publishedAt: string;
  downloadUrl?: string;
}

export interface PortalPhoto {
  id: string;
  caption: string;
  uploadedAt: string;
  customerVisible: boolean;
}

export interface PortalChangeOrder {
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
  appointments: PortalAppointment[];
  documents: PortalDocument[];
  photos: PortalPhoto[];
  changeOrders: PortalChangeOrder[];
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
