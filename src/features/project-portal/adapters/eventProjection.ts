import type {
  AppointmentScheduledPayload,
  ChangeOrderApprovedPayload,
  DocumentPublishedPayload,
  DocumentsViewModel,
  FreshnessState,
  FreshnessStatus,
  MilestoneCompletedPayload,
  PortalAppointment,
  PortalChangeOrder,
  PortalDocument,
  PortalEventEnvelope,
  PortalProjection,
  TimelineEntry,
  TimelineViewModel,
} from "../types/portal";

// ─── Freshness Thresholds ─────────────────────────────────────────────────────
// Per event-contract-spec.md stale-data behavior section.

const STALE_WARNING_MINUTES = 5;
const STALE_ELEVATED_MINUTES = 15;
const MS_PER_MINUTE = 60_000;

// ─── Freshness Computation ────────────────────────────────────────────────────

export function computeFreshness(lastSynchronizedAt: string): FreshnessStatus {
  const now = new Date();
  const syncTime = new Date(lastSynchronizedAt);
  const minutesSinceSync = Math.floor(
    (now.getTime() - syncTime.getTime()) / MS_PER_MINUTE,
  );

  let state: FreshnessState;
  if (minutesSinceSync < STALE_WARNING_MINUTES) {
    state = "fresh";
  } else if (minutesSinceSync < STALE_ELEVATED_MINUTES) {
    state = "stale_warning";
  } else {
    state = "stale_elevated";
  }

  return { state, lastSynchronizedAt, minutesSinceSync };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Filters out events whose idempotency_key has already been processed.
 * Returns only novel events (safe to apply) and the updated key set.
 *
 * Per event-contract-spec.md deduplication logic:
 * - Key is: <source_domain>:<event_type>:<aggregate_id>:<occurred_at>
 * - Once a key is stored, re-processing is skipped (ACK + discard)
 */
export function deduplicateEvents<P>(
  events: PortalEventEnvelope<P>[],
  processedKeys: ReadonlySet<string>,
): { novelEvents: PortalEventEnvelope<P>[]; newKeys: Set<string> } {
  const newKeys = new Set<string>(processedKeys);
  const novelEvents: PortalEventEnvelope<P>[] = [];

  for (const event of events) {
    if (newKeys.has(event.idempotency_key)) {
      // Already processed — discard without reprocessing
      continue;
    }
    novelEvents.push(event);
    newKeys.add(event.idempotency_key);
  }

  return { novelEvents, newKeys };
}

// ─── Projection Mappers ───────────────────────────────────────────────────────

function mapMilestoneToTimelineEntry(
  event: PortalEventEnvelope<MilestoneCompletedPayload>,
): TimelineEntry {
  const p = event.payload;
  return {
    id: event.event_id,
    milestoneId: p.milestone_id,
    milestoneName: p.milestone_name,
    milestoneSequence: p.milestone_sequence,
    completedAt: event.occurred_at,
    completedBy: p.completed_by,
    notesForPortal: p.notes_for_portal,
  };
}

function mapToAppointment(
  event: PortalEventEnvelope<AppointmentScheduledPayload>,
): PortalAppointment {
  const p = event.payload;
  return {
    id: p.appointment_id,
    scheduledDate: p.scheduled_date,
    scheduledWindow: p.scheduled_window,
    appointmentType: p.appointment_type,
    contactName: p.contact_name,
    contactPhone: p.contact_phone,
  };
}

function mapToChangeOrder(
  event: PortalEventEnvelope<ChangeOrderApprovedPayload>,
): PortalChangeOrder {
  const p = event.payload;
  return {
    id: p.change_order_id,
    changeOrderNumber: p.change_order_number,
    title: p.title,
    approvedAmountCents: p.approved_amount_cents,
    currency: p.currency,
    approvedAt: p.approved_at,
    effectiveDate: p.effective_date,
  };
}

function mapToDocument(
  event: PortalEventEnvelope<DocumentPublishedPayload>,
): PortalDocument | null {
  const p = event.payload;
  // Hard deny: internal documents are never surfaced in the portal projection
  if (p.visibility !== "customer") return null;

  return {
    id: p.document_id,
    name: p.document_name,
    documentType: p.document_type,
    fileSizeBytes: p.file_size_bytes,
    mimeType: p.mime_type,
    publishedAt: p.published_at,
    visibility: "customer",
  };
}

// ─── Full Projection Builder ──────────────────────────────────────────────────

export interface ProjectionInput {
  projectId: string;
  events: PortalEventEnvelope[];
  /** Previously processed idempotency keys — prevents duplicate application. */
  processedKeys?: ReadonlySet<string>;
  /**
   * Override the "now" time for freshness calculation.
   * Useful in tests to produce deterministic freshness states.
   */
  lastSynchronizedAt?: string;
}

/**
 * Builds the full portal projection view model from a stream of raw events.
 *
 * Processing rules (per event-contract-spec.md):
 *   1. Deduplicate by idempotency_key
 *   2. Filter events to this project's aggregate_id
 *   3. Map each event type to its projection target
 *   4. Document visibility: only "customer" documents are included
 *   5. Timeline entries are ordered by occurred_at ascending
 *   6. Compute freshness from the most recent event occurrence
 */
export function buildProjection(input: ProjectionInput): PortalProjection & {
  processedKeys: Set<string>;
} {
  const { projectId, events, processedKeys = new Set(), lastSynchronizedAt } =
    input;

  // Filter events for this project
  const projectEvents = events.filter((e) => e.aggregate_id === projectId);

  // Deduplicate
  const { novelEvents, newKeys } = deduplicateEvents(
    projectEvents,
    processedKeys,
  );

  const timelineEntries: TimelineEntry[] = [];
  const appointments: PortalAppointment[] = [];
  const changeOrders: PortalChangeOrder[] = [];
  const documents: PortalDocument[] = [];

  for (const event of novelEvents) {
    // Skip unsupported or future event_version major versions
    const [major] = event.event_version.split(".").map(Number);
    if (major > 1) continue; // graceful skip for unknown future versions

    switch (event.event_type) {
      case "milestone.completed": {
        const entry = mapMilestoneToTimelineEntry(
          event as PortalEventEnvelope<MilestoneCompletedPayload>,
        );
        timelineEntries.push(entry);
        break;
      }
      case "appointment.scheduled": {
        const appt = mapToAppointment(
          event as PortalEventEnvelope<AppointmentScheduledPayload>,
        );
        appointments.push(appt);
        break;
      }
      case "change_order.approved": {
        const co = mapToChangeOrder(
          event as PortalEventEnvelope<ChangeOrderApprovedPayload>,
        );
        changeOrders.push(co);
        break;
      }
      case "document.published": {
        const doc = mapToDocument(
          event as PortalEventEnvelope<DocumentPublishedPayload>,
        );
        if (doc) documents.push(doc);
        break;
      }
      default:
        // Unhandled event types are silently ignored
        break;
    }
  }

  // Sort timeline by occurred_at ascending (chronological)
  timelineEntries.sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  // Compute freshness
  const syncedAt =
    lastSynchronizedAt ??
    (projectEvents.length > 0
      ? projectEvents.reduce((latest, e) =>
          e.occurred_at > latest.occurred_at ? e : latest,
        ).occurred_at
      : new Date().toISOString());

  const freshness = computeFreshness(syncedAt);

  const timeline: TimelineViewModel = {
    projectId,
    entries: timelineEntries,
    lastSynchronizedAt: syncedAt,
  };

  const docsViewModel: DocumentsViewModel = {
    projectId,
    documents,
    lastSynchronizedAt: syncedAt,
  };

  return {
    project: null, // populated by PortalProvider from mockProjects
    timeline,
    documents: docsViewModel,
    appointments,
    changeOrders,
    contactTeam: null, // populated by PortalProvider from static contact data
    freshness,
    processedKeys: newKeys,
  };
}
