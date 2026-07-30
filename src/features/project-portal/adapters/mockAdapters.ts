import { getDayOverview, getJobPlanDetail } from "@/features/daily-plans/data/morningOperations";
import { getTodayDate } from "@/features/daily-plans/utils/planUtils";
import { mockDispatchEvents } from "@/features/dispatch/data/mockDispatchEvents";
import { mockDispatchPlans } from "@/features/dispatch/data/mockDispatchPlans";
import { estimateEquipmentBundles } from "@/features/installed-systems/data/estimateEquipmentBundles";
import { seedInstalledSystems } from "@/features/installed-systems/data/seedInstalledSystems";
import { mockJobs } from "@/features/jobs/data/mockJobs";
import { mockPerformanceSummaries } from "@/features/reporting/data/mockReporting";

import {
  fakeChangeOrdersProjectionRecords,
  fakeDocumentsProjectionRecords,
  fakePhotosProjectionRecords,
} from "../data/fakePortalArtifacts";
import type { PortalEventEnvelope } from "../types/events";
import type {
  ChangeOrdersAdapter,
  DailyPlansAdapter,
  DailyPlansProjectionRecord,
  DispatchAdapter,
  DispatchProjectionRecord,
  DocumentsAdapter,
  InstalledSystemsAdapter,
  InstalledSystemsProjectionRecord,
  JobsAdapter,
  JobsProjectionRecord,
  PhotosAdapter,
  PortalUpstreamAdapters,
  ReportingAdapter,
  ReportingProjectionRecord,
} from "./types";

function idempotencyKey(
  sourceDomain: PortalEventEnvelope["source_domain"],
  eventType: string,
  aggregateId: string,
  occurredAt: string
) {
  return `${sourceDomain}:${eventType}:${aggregateId}:${occurredAt}`;
}

function toPortalEvent(
  event: Omit<PortalEventEnvelope, "idempotency_key"> & {
    idempotency_key?: string;
  }
): PortalEventEnvelope {
  return {
    ...event,
    idempotency_key:
      event.idempotency_key ??
      idempotencyKey(
        event.source_domain,
        event.event_type,
        event.aggregate_id,
        event.occurred_at
      ),
  };
}

function numericUuid(seed: number, segment = 1) {
  return `00000000-0000-4${String(segment).padStart(3, "0")}-8000-${String(seed).padStart(12, "0")}`;
}

const jobsAdapter: JobsAdapter = {
  metadata: {
    adapterName: "mockJobsAdapter",
    adapterMode: "mock",
    readOnly: true,
    sourceDomain: "jobs",
  },
  async fetchProjectRecords(projectId) {
    return mockJobs
      .filter((job) => job.id === projectId)
      .map<JobsProjectionRecord>((job) => ({
        projectId: job.id,
        jobId: job.id,
        jobNumber: job.jobNumber,
        title: job.title,
        status: job.status,
        priority: job.priority,
        customerName: job.customerName,
        propertyName: job.propertyName,
        scheduledFor: job.scheduledFor ?? "",
        assignedProjectManager: job.assignedTo || undefined,
        summary: job.summary,
      }));
  },
  async fetchEvents(projectId) {
    return mockJobs
      .filter((job) => !projectId || job.id === projectId)
      .flatMap<PortalEventEnvelope>((job, index) => {
        const events: PortalEventEnvelope[] = [];

        if (job.type === "Inspection") {
          events.push(
            toPortalEvent({
              event_id: numericUuid(index + 1, 111),
              event_version: "1.0",
              event_type:
                job.status === "Completed"
                  ? "inspection.completed"
                  : "inspection.scheduled",
              occurred_at: `${job.scheduledFor ?? ""}T09:00:00.000Z`,
              source_domain: "jobs",
              aggregate_id: job.id,
              payload: {
                project_id: job.id,
                job_number: job.jobNumber,
                title: job.title,
                status: job.status,
              },
            })
          );
        }

        if (job.type === "Install" && job.status === "Completed") {
          events.push(
            toPortalEvent({
              event_id: numericUuid(index + 1, 222),
              event_version: "1.0",
              event_type: "installation.completed",
              occurred_at: `${job.scheduledFor ?? ""}T16:00:00.000Z`,
              source_domain: "jobs",
              aggregate_id: job.id,
              payload: {
                project_id: job.id,
                job_number: job.jobNumber,
                title: job.title,
              },
            })
          );
        }

        if (job.status === "Completed") {
          events.push(
            toPortalEvent({
              event_id: numericUuid(index + 1, 333),
              event_version: "1.0",
              event_type: "milestone.completed",
              occurred_at: `${job.scheduledFor ?? ""}T15:00:00.000Z`,
              source_domain: "jobs",
              aggregate_id: job.id,
              payload: {
                project_id: job.id,
                milestone_name: job.title,
                notes_for_portal: job.summary,
              },
            })
          );
        }

        return events;
      });
  },
};

const dailyPlansAdapter: DailyPlansAdapter = {
  metadata: {
    adapterName: "mockDailyPlansAdapter",
    adapterMode: "mock",
    readOnly: true,
    sourceDomain: "daily-plans",
  },
  async fetchProjectRecords(projectId) {
    const matchingJob = mockJobs.find((job) => job.id === projectId);
    if (!matchingJob) {
      return [];
    }

    const plan = getJobPlanDetail(projectId);
    const day = getDayOverview(matchingJob.scheduledFor ?? getTodayDate());
    const readinessState = !plan.materialsReady
      ? "blocked"
      : plan.constraints.length > 0
        ? "warning"
        : "ready";

    return [
      {
        projectId,
        serviceDate: matchingJob.scheduledFor ?? "",
        arrivalWindow: plan.arrivalWindow,
        readinessState,
        crewLead: matchingJob.assignedTo || undefined,
        summary: `${day.summary} ${plan.specialNotes ?? ""}`.trim(),
      } satisfies DailyPlansProjectionRecord,
    ];
  },
  async fetchEvents() {
    return [];
  },
};

const dispatchAdapter: DispatchAdapter = {
  metadata: {
    adapterName: "mockDispatchAdapter",
    adapterMode: "mock",
    readOnly: true,
    sourceDomain: "dispatch",
  },
  async fetchProjectRecords(projectId) {
    return mockDispatchPlans
      .filter((plan) => plan.jobId === projectId)
      .map<DispatchProjectionRecord>((plan) => ({
        projectId: plan.jobId,
        dispatchPlanId: plan.id,
        jobNumber: plan.jobNumber,
        dispatchStatus: plan.dispatchStatus,
        targetDate: plan.targetDate,
        estimatedDurationHours: plan.estimatedDurationHours,
        crewName: plan.dispatchability.crewReadiness.reason,
        sequencingNotes: plan.sequencingNotes,
      }));
  },
  async fetchEvents(projectId) {
    const allowedPlanIds = new Set(
      mockDispatchPlans
        .filter((plan) => !projectId || plan.jobId === projectId)
        .map((plan) => plan.id)
    );

    return mockDispatchEvents
      .filter((event) => allowedPlanIds.has(event.dispatchPlanId))
      .map<PortalEventEnvelope>((event) => {
        const plan = mockDispatchPlans.find((candidate) => candidate.id === event.dispatchPlanId);
        const aggregateId = plan?.jobId ?? event.dispatchPlanId;
        const eventType =
          event.type === "job_scheduled"
            ? "appointment.scheduled"
            : event.type === "schedule_changed" || event.type === "job_rescheduled"
              ? "appointment.updated"
              : event.type === "crew_dispatched"
                ? "crew.dispatched"
                : "appointment.updated";

        return toPortalEvent({
          event_id: numericUuid(Number.parseInt(event.id.replace(/\D/g, ""), 10) || 1, 444),
          event_version: "1.0",
          event_type: eventType,
          occurred_at: new Date(event.timestamp).toISOString(),
          source_domain: "dispatch",
          aggregate_id: aggregateId,
          payload: {
            dispatch_plan_id: event.dispatchPlanId,
            description: event.description,
            ...(event.metadata ?? {}),
          },
        });
      });
  },
};

const installedSystemsAdapter: InstalledSystemsAdapter = {
  metadata: {
    adapterName: "mockInstalledSystemsAdapter",
    adapterMode: "mock",
    readOnly: true,
    sourceDomain: "installed-systems",
  },
  async fetchProjectRecords(projectId) {
    const installedMatches = seedInstalledSystems.filter((system) =>
      system.linkedWorkflowIds.includes(projectId)
    );
    const estimateMatches = estimateEquipmentBundles.filter(
      (bundle) => mockJobs.find((job) => job.id === projectId)?.equipmentBundleId === bundle.id
    );

    return [
      ...installedMatches.map<InstalledSystemsProjectionRecord>((system) => ({
        projectId,
        installedSystemId: system.id,
        systemName: system.systemName,
        lifecycleStatus: system.lifecycleStatus,
        installDate: system.installDate,
        permitReady: system.permitReady,
      })),
      ...estimateMatches.map<InstalledSystemsProjectionRecord>((bundle) => ({
        projectId,
        installedSystemId: bundle.id,
        systemName: bundle.systemName,
        lifecycleStatus: "Planned",
        installDate: mockJobs.find((job) => job.id === projectId)?.scheduledFor ?? bundle.soldDate,
        permitReady: true,
      })),
    ];
  },
  async fetchEvents() {
    return [];
  },
};

const documentsAdapter: DocumentsAdapter = {
  metadata: {
    adapterName: "mockDocumentsAdapter",
    adapterMode: "mock",
    readOnly: true,
    sourceDomain: "documents",
  },
  async fetchProjectRecords(projectId) {
    return fakeDocumentsProjectionRecords.filter((record) => record.projectId === projectId);
  },
  async fetchEvents(projectId) {
    return fakeDocumentsProjectionRecords
      .filter((record) => !projectId || record.projectId === projectId)
      .filter((record) => record.visibility === "customer")
      .map((record, index) =>
        toPortalEvent({
          event_id: `66666666-6666-4666-8666-${String(index + 1).padStart(12, "0")}`,
          event_version: "1.0",
          event_type: "document.published",
          occurred_at: record.publishedAt,
          source_domain: "documents",
          aggregate_id: record.projectId,
          payload: {
            document_id: record.documentId,
            project_id: record.projectId,
            title: record.title,
            category: record.category,
          },
        })
      );
  },
};

const photosAdapter: PhotosAdapter = {
  metadata: {
    adapterName: "mockPhotosAdapter",
    adapterMode: "mock",
    readOnly: true,
    sourceDomain: "photos",
  },
  async fetchProjectRecords(projectId) {
    return fakePhotosProjectionRecords.filter((record) => record.projectId === projectId);
  },
  async fetchEvents(projectId) {
    return fakePhotosProjectionRecords
      .filter((record) => !projectId || record.projectId === projectId)
      .filter((record) => record.customerVisible)
      .map((record, index) =>
        toPortalEvent({
          event_id: `77777777-7777-4777-8777-${String(index + 1).padStart(12, "0")}`,
          event_version: "1.0",
          event_type: "photo.uploaded",
          occurred_at: record.uploadedAt,
          source_domain: "photos",
          aggregate_id: record.projectId,
          payload: {
            photo_id: record.photoId,
            project_id: record.projectId,
            caption: record.caption,
          },
        })
      );
  },
};

const changeOrdersAdapter: ChangeOrdersAdapter = {
  metadata: {
    adapterName: "mockChangeOrdersAdapter",
    adapterMode: "mock",
    readOnly: true,
    sourceDomain: "change-orders",
  },
  async fetchProjectRecords(projectId) {
    return fakeChangeOrdersProjectionRecords.filter((record) => record.projectId === projectId);
  },
  async fetchEvents(projectId) {
    return fakeChangeOrdersProjectionRecords
      .filter((record) => !projectId || record.projectId === projectId)
      .map((record, index) =>
        toPortalEvent({
          event_id: `88888888-8888-4888-8888-${String(index + 1).padStart(12, "0")}`,
          event_version: "1.0",
          event_type: "change_order.approved",
          occurred_at: record.approvedAt,
          source_domain: "change-orders",
          aggregate_id: record.projectId,
          payload: {
            change_order_id: record.changeOrderId,
            project_id: record.projectId,
            title: record.title,
            approved_amount_cents: record.approvedAmountCents,
            currency: record.currency,
            approved_at: record.approvedAt,
          },
        })
      );
  },
};

const reportingAdapter: ReportingAdapter = {
  metadata: {
    adapterName: "mockReportingAdapter",
    adapterMode: "mock",
    readOnly: true,
    sourceDomain: "reporting",
  },
  async fetchProjectRecords(projectId) {
    const baseSummary = mockPerformanceSummaries[0];
    if (!baseSummary || projectId !== "job-001") {
      return [];
    }

    return [
      {
        projectId,
        metricId: baseSummary.id,
        label: "Completion",
        value: 82,
        unit: "percent",
        trend: "improving",
        generatedAt: `${baseSummary.generatedAt}T12:00:00.000Z`,
      } satisfies ReportingProjectionRecord,
    ];
  },
  async fetchEvents() {
    return [];
  },
};

export function createMockPortalAdapters(): PortalUpstreamAdapters {
  return {
    jobs: jobsAdapter,
    dailyPlans: dailyPlansAdapter,
    dispatch: dispatchAdapter,
    installedSystems: installedSystemsAdapter,
    documents: documentsAdapter,
    photos: photosAdapter,
    changeOrders: changeOrdersAdapter,
    reporting: reportingAdapter,
  };
}
