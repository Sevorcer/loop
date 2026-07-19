import type { PortalIntegrationSnapshot, PortalUpstreamAdapters } from "../adapters/types";
import type { PortalEventEnvelope } from "../types/events";
import type {
  PortalProjectionState,
  PortalSourceDomain,
  PortalTimelineEntry,
} from "../types/portal";

function uniqDomains(domains: PortalSourceDomain[]): PortalSourceDomain[] {
  return Array.from(new Set(domains));
}

function completionPercentFromStatus(status: string) {
  switch (status) {
    case "Completed":
    case "completed":
      return 100;
    case "In Progress":
    case "in_progress":
      return 75;
    case "Scheduled":
    case "scheduled":
      return 45;
    case "On Hold":
    case "awaiting_materials":
    case "awaiting_customer_confirmation":
      return 25;
    default:
      return 10;
  }
}

function labelForEvent(event: PortalEventEnvelope) {
  switch (event.event_type) {
    case "milestone.completed":
      return String(event.payload.milestone_name ?? "Milestone completed");
    case "inspection.scheduled":
      return "Inspection scheduled";
    case "inspection.completed":
      return "Inspection completed";
    case "appointment.scheduled":
      return "Appointment scheduled";
    case "appointment.updated":
      return "Appointment updated";
    case "crew.dispatched":
      return "Crew dispatched";
    case "crew.arrived":
      return "Crew arrived";
    case "installation.completed":
      return "Installation completed";
    case "startup.completed":
      return "Startup completed";
    case "change_order.approved":
      return String(event.payload.title ?? "Approved change order");
    case "document.published":
      return String(event.payload.title ?? "Document published");
    case "photo.uploaded":
      return String(event.payload.caption ?? "Photo uploaded");
    default:
      return event.event_type;
  }
}

function buildTimeline(events: readonly PortalEventEnvelope[]): PortalTimelineEntry[] {
  return [...events]
    .sort((left, right) => {
      const delta = Date.parse(left.occurred_at) - Date.parse(right.occurred_at);
      if (delta !== 0) {
        return delta;
      }
      return left.idempotency_key.localeCompare(right.idempotency_key);
    })
    .map((event) => ({
      id: event.event_id,
      eventType: event.event_type,
      label: labelForEvent(event),
      occurredAt: event.occurred_at,
      sourceDomain: event.source_domain,
      summary:
        typeof event.payload.notes_for_portal === "string"
          ? event.payload.notes_for_portal
          : typeof event.payload.description === "string"
            ? event.payload.description
            : undefined,
    }));
}

export async function collectPortalIntegrationSnapshot(
  adapters: PortalUpstreamAdapters,
  projectId: string
): Promise<PortalIntegrationSnapshot> {
  const [
    jobs,
    dailyPlans,
    dispatch,
    installedSystems,
    documents,
    photos,
    changeOrders,
    reporting,
    jobEvents,
    dispatchEvents,
    installedSystemsEvents,
    documentEvents,
    photoEvents,
    changeOrderEvents,
  ] = await Promise.all([
    adapters.jobs.fetchProjectRecords(projectId),
    adapters.dailyPlans.fetchProjectRecords(projectId),
    adapters.dispatch.fetchProjectRecords(projectId),
    adapters.installedSystems.fetchProjectRecords(projectId),
    adapters.documents.fetchProjectRecords(projectId),
    adapters.photos.fetchProjectRecords(projectId),
    adapters.changeOrders.fetchProjectRecords(projectId),
    adapters.reporting?.fetchProjectRecords(projectId) ?? Promise.resolve([]),
    adapters.jobs.fetchEvents(projectId),
    adapters.dispatch.fetchEvents(projectId),
    adapters.installedSystems.fetchEvents(projectId),
    adapters.documents.fetchEvents(projectId),
    adapters.photos.fetchEvents(projectId),
    adapters.changeOrders.fetchEvents(projectId),
  ]);

  return {
    projectId,
    jobs,
    dailyPlans,
    dispatch,
    installedSystems,
    documents,
    photos,
    changeOrders,
    reporting,
    events: [
      ...jobEvents,
      ...dispatchEvents,
      ...installedSystemsEvents,
      ...documentEvents,
      ...photoEvents,
      ...changeOrderEvents,
    ],
  };
}

export function buildPortalProjectionState(
  snapshot: PortalIntegrationSnapshot
): PortalProjectionState {
  const primaryJob = snapshot.jobs[0];
  const completionMetric = snapshot.reporting.find(
    (metric) => metric.label.toLowerCase() === "completion"
  );
  const timeline = buildTimeline(snapshot.events);
  const lastEventAt = timeline.at(-1)?.occurredAt;
  const upcomingMilestone = [
    ...snapshot.dispatch.map((record) => ({
      date: record.targetDate,
      label: record.dispatchStatus,
    })),
    ...snapshot.dailyPlans.map((record) => ({
      date: record.serviceDate,
      label: record.summary,
    })),
  ]
    .filter((candidate) => !Number.isNaN(Date.parse(candidate.date)))
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date))[0];

  return {
    projectId: snapshot.projectId,
    overview: {
      projectId: snapshot.projectId,
      title: primaryJob?.title ?? snapshot.installedSystems[0]?.systemName ?? "Project Portal Project",
      customerName: primaryJob?.customerName ?? "Portal customer",
      propertyName: primaryJob?.propertyName ?? "Portal property",
      status: primaryJob?.status ?? snapshot.dispatch[0]?.dispatchStatus ?? "Not started",
      completionPercent:
        completionMetric?.value ?? completionPercentFromStatus(primaryJob?.status ?? "Not started"),
      estimatedCompletionDate:
        snapshot.dispatch[0]?.targetDate ?? primaryJob?.scheduledFor ?? undefined,
      nextMilestone: upcomingMilestone?.label ?? timeline.at(-1)?.label,
      assignedProjectManager: primaryJob?.assignedProjectManager,
      lastUpdated: lastEventAt,
    },
    timeline,
    appointments: [
      ...snapshot.dailyPlans.map((record) => ({
        id: `${record.projectId}:${record.serviceDate}`,
        source: "daily-plans" as const,
        scheduledDate: record.serviceDate,
        scheduledWindow: record.arrivalWindow,
        type: record.readinessState === "blocked" ? "Needs attention" : "Upcoming visit",
        contactName: record.crewLead,
      })),
      ...snapshot.dispatch.map((record) => ({
        id: record.dispatchPlanId,
        source: "dispatch" as const,
        scheduledDate: record.targetDate,
        scheduledWindow: `${record.estimatedDurationHours}h window`,
        type: record.dispatchStatus,
        contactName: record.crewName,
      })),
    ],
    documents: snapshot.documents.filter((document) => document.visibility === "customer").map((document) => ({
      id: document.documentId,
      title: document.title,
      category: document.category,
      visibility: document.visibility,
      publishedAt: document.publishedAt,
      downloadUrl: document.downloadUrl,
    })),
    photos: snapshot.photos.filter((photo) => photo.customerVisible).map((photo) => ({
      id: photo.photoId,
      caption: photo.caption,
      uploadedAt: photo.uploadedAt,
      customerVisible: photo.customerVisible,
    })),
    changeOrders: snapshot.changeOrders.map((changeOrder) => ({
      id: changeOrder.changeOrderId,
      title: changeOrder.title,
      status: changeOrder.status,
      approvedAmountCents: changeOrder.approvedAmountCents,
      currency: changeOrder.currency,
      approvedAt: changeOrder.approvedAt,
    })),
    installedSystems: snapshot.installedSystems.map((system) => ({
      id: system.installedSystemId,
      systemName: system.systemName,
      lifecycleStatus: system.lifecycleStatus,
      installDate: system.installDate,
      permitReady: system.permitReady,
    })),
    metrics: snapshot.reporting.map((metric) => ({
      id: metric.metricId,
      label: metric.label,
      value: metric.value,
      unit: metric.unit,
      trend: metric.trend,
      generatedAt: metric.generatedAt,
    })),
    lastEventAt,
    lastSynchronizedAt: new Date().toISOString(),
    sourceDomains: uniqDomains([
      ...snapshot.jobs.map(() => "jobs" as const),
      ...snapshot.dailyPlans.map(() => "daily-plans" as const),
      ...snapshot.dispatch.map(() => "dispatch" as const),
      ...snapshot.installedSystems.map(() => "installed-systems" as const),
      ...snapshot.documents.map(() => "documents" as const),
      ...snapshot.photos.map(() => "photos" as const),
      ...snapshot.changeOrders.map(() => "change-orders" as const),
      ...snapshot.reporting.map(() => "reporting" as const),
    ]),
  };
}

export function applyPortalEventToProjection(
  currentState: PortalProjectionState,
  event: PortalEventEnvelope,
  processedAt = new Date().toISOString()
): PortalProjectionState {
  const nextTimeline = buildTimeline([
    ...currentState.timeline.map((entry) => ({
      event_id: entry.id,
      event_version: "1.0",
      event_type: entry.eventType,
      occurred_at: entry.occurredAt,
      source_domain: entry.sourceDomain,
      aggregate_id: currentState.projectId,
      idempotency_key: `${entry.sourceDomain}:${entry.eventType}:${currentState.projectId}:${entry.occurredAt}`,
      payload: {
        title: entry.label,
        notes_for_portal: entry.summary,
      },
    })),
    event,
  ]);

  return {
    ...currentState,
    timeline: nextTimeline,
    lastEventAt: event.occurred_at,
    lastSynchronizedAt: processedAt,
    sourceDomains: uniqDomains([...currentState.sourceDomains, event.source_domain]),
    overview: {
      ...currentState.overview,
      status:
        event.event_type === "installation.completed"
          ? "Completed"
          : currentState.overview.status,
      nextMilestone: nextTimeline.at(-1)?.label,
      lastUpdated: processedAt,
    },
  };
}
