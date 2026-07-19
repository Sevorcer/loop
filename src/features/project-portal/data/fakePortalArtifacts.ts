import type { PortalEventEnvelope } from "../types/events";
import type {
  ChangeOrdersProjectionRecord,
  DailyPlansProjectionRecord,
  DispatchProjectionRecord,
  DocumentsProjectionRecord,
  InstalledSystemsProjectionRecord,
  JobsProjectionRecord,
  PhotosProjectionRecord,
  ReportingProjectionRecord,
} from "../adapters/types";

export const fakeJobsProjectionRecords: JobsProjectionRecord[] = [
  {
    projectId: "job-001",
    jobId: "job-001",
    jobNumber: "PORTAL-1001",
    title: "Whole-home replacement",
    status: "Scheduled",
    priority: "High",
    customerName: "John Smith",
    propertyName: "Smith Residence",
    scheduledFor: "2026-07-21",
    assignedProjectManager: "Marcus Rivera",
    summary: "Production-safe portal demo project backed by fake upstream adapters.",
  },
];

export const fakeDailyPlansProjectionRecords: DailyPlansProjectionRecord[] = [
  {
    projectId: "job-001",
    serviceDate: "2026-07-21",
    arrivalWindow: "07:00 – 07:30 AM",
    readinessState: "ready",
    crewLead: "Marcus Rivera",
    summary: "Morning packet released and customer confirmed.",
  },
];

export const fakeDispatchProjectionRecords: DispatchProjectionRecord[] = [
  {
    projectId: "job-001",
    dispatchPlanId: "fake-dp-001",
    jobNumber: "PORTAL-1001",
    dispatchStatus: "scheduled",
    targetDate: "2026-07-21",
    estimatedDurationHours: 8,
    crewName: "Install Truck 4",
    sequencingNotes: "Outdoor unit first, air handler second, startup after electrical verification.",
  },
];

export const fakeInstalledSystemsProjectionRecords: InstalledSystemsProjectionRecord[] = [
  {
    projectId: "job-001",
    installedSystemId: "fake-system-001",
    systemName: "Main Floor Hyper-Heat Replacement",
    lifecycleStatus: "Planned",
    installDate: "2026-07-21",
    permitReady: true,
  },
];

export const fakeDocumentsProjectionRecords: DocumentsProjectionRecord[] = [
  {
    projectId: "job-001",
    documentId: "fake-doc-001",
    title: "Signed Agreement",
    category: "agreement",
    visibility: "customer",
    publishedAt: "2026-07-19T09:30:00.000Z",
    downloadUrl: "/portal/fake-doc-001.pdf",
  },
  {
    projectId: "job-001",
    documentId: "fake-doc-002",
    title: "Internal coordination note",
    category: "internal-note",
    visibility: "internal",
    publishedAt: "2026-07-19T10:30:00.000Z",
  },
];

export const fakePhotosProjectionRecords: PhotosProjectionRecord[] = [
  {
    projectId: "job-001",
    photoId: "fake-photo-001",
    caption: "Equipment staging complete.",
    uploadedAt: "2026-07-19T11:00:00.000Z",
    customerVisible: true,
  },
];

export const fakeChangeOrdersProjectionRecords: ChangeOrdersProjectionRecord[] = [
  {
    projectId: "job-001",
    changeOrderId: "fake-co-001",
    title: "Thermostat upgrade",
    status: "approved",
    approvedAmountCents: 29900,
    currency: "USD",
    approvedAt: "2026-07-18T16:45:00.000Z",
  },
];

export const fakeReportingProjectionRecords: ReportingProjectionRecord[] = [
  {
    projectId: "portal-project-001",
    metricId: "fake-metric-001",
    label: "Completion",
    value: 68,
    unit: "percent",
    trend: "improving",
    generatedAt: "2026-07-19T12:00:00.000Z",
  },
];

export const fakePortalEvents: PortalEventEnvelope[] = [
  {
    event_id: "00000000-0000-4000-8000-000000000001",
    event_version: "1.0",
    event_type: "appointment.scheduled",
    occurred_at: "2026-07-19T09:00:00.000Z",
    source_domain: "dispatch",
    aggregate_id: "job-001",
    idempotency_key:
      "dispatch:appointment.scheduled:job-001:2026-07-19T09:00:00.000Z",
    payload: {
      appointment_id: "appt-001",
      project_id: "job-001",
      scheduled_date: "2026-07-21",
      scheduled_window: "07:00 – 07:30 AM",
      appointment_type: "Installation",
      contact_name: "Marcus Rivera",
    },
  },
  {
    event_id: "00000000-0000-4000-8000-000000000002",
    event_version: "1.0",
    event_type: "document.published",
    occurred_at: "2026-07-19T09:30:00.000Z",
    source_domain: "documents",
    aggregate_id: "job-001",
    idempotency_key:
      "documents:document.published:job-001:2026-07-19T09:30:00.000Z",
    payload: {
      document_id: "fake-doc-001",
      project_id: "job-001",
      title: "Signed Agreement",
      category: "agreement",
    },
  },
  {
    event_id: "00000000-0000-4000-8000-000000000003",
    event_version: "1.0",
    event_type: "change_order.approved",
    occurred_at: "2026-07-18T16:45:00.000Z",
    source_domain: "change-orders",
    aggregate_id: "job-001",
    idempotency_key:
      "change-orders:change_order.approved:job-001:2026-07-18T16:45:00.000Z",
    payload: {
      change_order_id: "fake-co-001",
      project_id: "job-001",
      title: "Thermostat upgrade",
      approved_amount_cents: 29900,
      currency: "USD",
      approved_at: "2026-07-18T16:45:00.000Z",
    },
  },
];
