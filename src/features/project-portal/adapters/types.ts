import type { PortalEventEnvelope } from "../types/events";
import type {
  PortalDocumentVisibility,
  PortalSourceDomain,
} from "../types/integration";

export interface PortalAdapterMetadata {
  adapterName: string;
  adapterMode: "mock" | "fake";
  readOnly: true;
  sourceDomain: PortalSourceDomain;
}

export interface PortalReadOnlyAdapter<TRecord> {
  readonly metadata: PortalAdapterMetadata;
  fetchProjectRecords(projectId: string): Promise<readonly TRecord[]>;
  fetchEvents(projectId?: string): Promise<readonly PortalEventEnvelope[]>;
}

export interface JobsProjectionRecord {
  projectId: string;
  jobId: string;
  jobNumber: string;
  title: string;
  status: string;
  priority: string;
  customerName: string;
  propertyName: string;
  scheduledFor: string;
  assignedProjectManager?: string;
  summary: string;
}

export interface DailyPlansProjectionRecord {
  projectId: string;
  serviceDate: string;
  arrivalWindow: string;
  readinessState: "ready" | "warning" | "blocked";
  crewLead?: string;
  summary: string;
}

export interface DispatchProjectionRecord {
  projectId: string;
  dispatchPlanId: string;
  jobNumber: string;
  dispatchStatus: string;
  targetDate: string;
  estimatedDurationHours: number;
  crewName?: string;
  sequencingNotes?: string;
}

export interface InstalledSystemsProjectionRecord {
  projectId: string;
  installedSystemId: string;
  systemName: string;
  lifecycleStatus: string;
  installDate: string;
  permitReady: boolean;
}

export interface DocumentsProjectionRecord {
  projectId: string;
  documentId: string;
  title: string;
  category: string;
  visibility: PortalDocumentVisibility;
  publishedAt: string;
  downloadUrl?: string;
}

export interface PhotosProjectionRecord {
  projectId: string;
  photoId: string;
  caption: string;
  uploadedAt: string;
  customerVisible: boolean;
}

export interface ChangeOrdersProjectionRecord {
  projectId: string;
  changeOrderId: string;
  title: string;
  status: "approved";
  approvedAmountCents: number;
  currency: string;
  approvedAt: string;
}

export interface ReportingProjectionRecord {
  projectId: string;
  metricId: string;
  label: string;
  value: number;
  unit: string;
  trend: string;
  generatedAt: string;
}

export interface JobsAdapter
  extends PortalReadOnlyAdapter<JobsProjectionRecord> {
  readonly metadata: PortalAdapterMetadata & { sourceDomain: "jobs" };
}

export interface DailyPlansAdapter
  extends PortalReadOnlyAdapter<DailyPlansProjectionRecord> {
  readonly metadata: PortalAdapterMetadata & { sourceDomain: "daily-plans" };
}

export interface DispatchAdapter
  extends PortalReadOnlyAdapter<DispatchProjectionRecord> {
  readonly metadata: PortalAdapterMetadata & { sourceDomain: "dispatch" };
}

export interface InstalledSystemsAdapter
  extends PortalReadOnlyAdapter<InstalledSystemsProjectionRecord> {
  readonly metadata: PortalAdapterMetadata & { sourceDomain: "installed-systems" };
}

export interface DocumentsAdapter
  extends PortalReadOnlyAdapter<DocumentsProjectionRecord> {
  readonly metadata: PortalAdapterMetadata & { sourceDomain: "documents" };
}

export interface PhotosAdapter
  extends PortalReadOnlyAdapter<PhotosProjectionRecord> {
  readonly metadata: PortalAdapterMetadata & { sourceDomain: "photos" };
}

export interface ChangeOrdersAdapter
  extends PortalReadOnlyAdapter<ChangeOrdersProjectionRecord> {
  readonly metadata: PortalAdapterMetadata & { sourceDomain: "change-orders" };
}

export interface ReportingAdapter
  extends PortalReadOnlyAdapter<ReportingProjectionRecord> {
  readonly metadata: PortalAdapterMetadata & { sourceDomain: "reporting" };
}

export interface PortalUpstreamAdapters {
  jobs: JobsAdapter;
  dailyPlans: DailyPlansAdapter;
  dispatch: DispatchAdapter;
  installedSystems: InstalledSystemsAdapter;
  documents: DocumentsAdapter;
  photos: PhotosAdapter;
  changeOrders: ChangeOrdersAdapter;
  reporting?: ReportingAdapter;
}

export interface PortalIntegrationSnapshot {
  projectId: string;
  jobs: readonly JobsProjectionRecord[];
  dailyPlans: readonly DailyPlansProjectionRecord[];
  dispatch: readonly DispatchProjectionRecord[];
  installedSystems: readonly InstalledSystemsProjectionRecord[];
  documents: readonly DocumentsProjectionRecord[];
  photos: readonly PhotosProjectionRecord[];
  changeOrders: readonly ChangeOrdersProjectionRecord[];
  reporting: readonly ReportingProjectionRecord[];
  events: readonly PortalEventEnvelope[];
}
