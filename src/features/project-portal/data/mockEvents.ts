import type {
  AppointmentScheduledPayload,
  ChangeOrderApprovedPayload,
  DocumentPublishedPayload,
  MilestoneCompletedPayload,
  PortalEventEnvelope,
} from "../types/portal";

// ─── Deterministic mock event stream ─────────────────────────────────────────
// Per event-contract-spec.md — all 4 required fixture event types.

export const MOCK_PROJECT_ID = "proj-0001-uuid";

export const mockEventStream: PortalEventEnvelope[] = [
  // ── milestone.completed ──────────────────────────────────────────────────
  {
    event_id: "a1b2c3d4-0001-4abc-8def-000000000001",
    event_version: "1.0",
    event_type: "milestone.completed",
    occurred_at: "2026-07-10T10:00:00.000Z",
    source_domain: "jobs",
    aggregate_id: MOCK_PROJECT_ID,
    idempotency_key: `jobs:milestone.completed:${MOCK_PROJECT_ID}:2026-07-10T10:00:00.000Z`,
    payload: {
      milestone_id: "ms-0001-uuid",
      milestone_name: "Estimate Approved",
      milestone_sequence: 1,
      completed_by: "Sarah Chen",
      notes_for_portal: "Estimate approved by homeowner. Project kickoff scheduled.",
      project_id: MOCK_PROJECT_ID,
    } satisfies MilestoneCompletedPayload,
  },
  {
    event_id: "a1b2c3d4-0002-4abc-8def-000000000002",
    event_version: "1.0",
    event_type: "milestone.completed",
    occurred_at: "2026-07-12T14:00:00.000Z",
    source_domain: "jobs",
    aggregate_id: MOCK_PROJECT_ID,
    idempotency_key: `jobs:milestone.completed:${MOCK_PROJECT_ID}:2026-07-12T14:00:00.000Z`,
    payload: {
      milestone_id: "ms-0002-uuid",
      milestone_name: "Permit Submitted",
      milestone_sequence: 2,
      completed_by: "Sarah Chen",
      notes_for_portal: "Building permit application submitted to the city.",
      project_id: MOCK_PROJECT_ID,
    } satisfies MilestoneCompletedPayload,
  },
  {
    event_id: "a1b2c3d4-0003-4abc-8def-000000000003",
    event_version: "1.0",
    event_type: "milestone.completed",
    occurred_at: "2026-07-15T09:30:00.000Z",
    source_domain: "jobs",
    aggregate_id: MOCK_PROJECT_ID,
    idempotency_key: `jobs:milestone.completed:${MOCK_PROJECT_ID}:2026-07-15T09:30:00.000Z`,
    payload: {
      milestone_id: "ms-0003-uuid",
      milestone_name: "Equipment Ordered",
      milestone_sequence: 3,
      completed_by: "Marcus Webb",
      notes_for_portal:
        "Carrier 5-ton unit and Honeywell smart thermostat ordered. ETA 3–5 business days.",
      project_id: MOCK_PROJECT_ID,
    } satisfies MilestoneCompletedPayload,
  },
  {
    event_id: "a1b2c3d4-0004-4abc-8def-000000000004",
    event_version: "1.0",
    event_type: "milestone.completed",
    occurred_at: "2026-07-19T14:30:00.000Z",
    source_domain: "jobs",
    aggregate_id: MOCK_PROJECT_ID,
    idempotency_key: `jobs:milestone.completed:${MOCK_PROJECT_ID}:2026-07-19T14:30:00.000Z`,
    payload: {
      milestone_id: "ms-0006-uuid",
      milestone_name: "Rough-In Complete",
      milestone_sequence: 6,
      completed_by: "Marcus Webb",
      notes_for_portal: "Rough-in inspection scheduled for next week.",
      project_id: MOCK_PROJECT_ID,
    } satisfies MilestoneCompletedPayload,
  },

  // ── appointment.scheduled ────────────────────────────────────────────────
  {
    event_id: "b2c3d4e5-0002-4abc-8def-000000000002",
    event_version: "1.0",
    event_type: "appointment.scheduled",
    occurred_at: "2026-07-19T09:00:00.000Z",
    source_domain: "dispatch",
    aggregate_id: MOCK_PROJECT_ID,
    idempotency_key: `dispatch:appointment.scheduled:${MOCK_PROJECT_ID}:2026-07-19T09:00:00.000Z`,
    payload: {
      appointment_id: "appt-0002-uuid",
      project_id: MOCK_PROJECT_ID,
      scheduled_date: "2026-07-22",
      scheduled_window: "08:00–12:00",
      appointment_type: "Inspection",
      contact_name: "Sarah Chen",
      contact_phone: "555-100-2000",
    } satisfies AppointmentScheduledPayload,
  },
  {
    event_id: "b2c3d4e5-0003-4abc-8def-000000000003",
    event_version: "1.0",
    event_type: "appointment.scheduled",
    occurred_at: "2026-07-20T11:00:00.000Z",
    source_domain: "dispatch",
    aggregate_id: MOCK_PROJECT_ID,
    idempotency_key: `dispatch:appointment.scheduled:${MOCK_PROJECT_ID}:2026-07-20T11:00:00.000Z`,
    payload: {
      appointment_id: "appt-0003-uuid",
      project_id: MOCK_PROJECT_ID,
      scheduled_date: "2026-07-28",
      scheduled_window: "09:00–13:00",
      appointment_type: "Installation",
      contact_name: "Marcus Webb",
      contact_phone: "555-100-2001",
    } satisfies AppointmentScheduledPayload,
  },

  // ── change_order.approved ────────────────────────────────────────────────
  {
    event_id: "c3d4e5f6-0003-4abc-8def-000000000003",
    event_version: "1.0",
    event_type: "change_order.approved",
    occurred_at: "2026-07-18T16:45:00.000Z",
    source_domain: "change-orders",
    aggregate_id: MOCK_PROJECT_ID,
    idempotency_key: `change-orders:change_order.approved:${MOCK_PROJECT_ID}:2026-07-18T16:45:00.000Z`,
    payload: {
      change_order_id: "co-0003-uuid",
      project_id: MOCK_PROJECT_ID,
      change_order_number: "CO-007",
      title: "Thermostat Upgrade to Smart Control",
      approved_amount_cents: 29900,
      currency: "USD",
      approved_at: "2026-07-18T16:45:00.000Z",
      effective_date: "2026-07-22",
    } satisfies ChangeOrderApprovedPayload,
  },

  // ── document.published ───────────────────────────────────────────────────
  {
    event_id: "d4e5f6a7-0004-4abc-8def-000000000004",
    event_version: "1.0",
    event_type: "document.published",
    occurred_at: "2026-07-13T11:00:00.000Z",
    source_domain: "documents",
    aggregate_id: MOCK_PROJECT_ID,
    idempotency_key: `documents:document.published:${MOCK_PROJECT_ID}:2026-07-13T11:00:00.000Z`,
    payload: {
      document_id: "doc-0001-uuid",
      project_id: MOCK_PROJECT_ID,
      document_name: "Signed Service Agreement",
      document_type: "signed_agreement",
      visibility: "customer",
      file_size_bytes: 153600,
      mime_type: "application/pdf",
      published_at: "2026-07-13T11:00:00.000Z",
    } satisfies DocumentPublishedPayload,
  },
  {
    event_id: "d4e5f6a7-0005-4abc-8def-000000000005",
    event_version: "1.0",
    event_type: "document.published",
    occurred_at: "2026-07-17T11:00:00.000Z",
    source_domain: "documents",
    aggregate_id: MOCK_PROJECT_ID,
    idempotency_key: `documents:document.published:${MOCK_PROJECT_ID}:2026-07-17T11:00:00.000Z`,
    payload: {
      document_id: "doc-0004-uuid",
      project_id: MOCK_PROJECT_ID,
      document_name: "Inspection Report — Rough-In",
      document_type: "inspection_report",
      visibility: "customer",
      file_size_bytes: 204800,
      mime_type: "application/pdf",
      published_at: "2026-07-17T11:00:00.000Z",
    } satisfies DocumentPublishedPayload,
  },
  // Internal doc — must be filtered out by projection layer (not in output)
  {
    event_id: "d4e5f6a7-0006-4abc-8def-000000000006",
    event_version: "1.0",
    event_type: "document.published",
    occurred_at: "2026-07-18T08:00:00.000Z",
    source_domain: "documents",
    aggregate_id: MOCK_PROJECT_ID,
    idempotency_key: `documents:document.published:${MOCK_PROJECT_ID}:2026-07-18T08:00:00.000Z`,
    payload: {
      document_id: "doc-internal-uuid",
      project_id: MOCK_PROJECT_ID,
      document_name: "Internal Crew Note",
      document_type: "internal_note",
      visibility: "internal",
      file_size_bytes: 4096,
      mime_type: "text/plain",
      published_at: "2026-07-18T08:00:00.000Z",
    } satisfies DocumentPublishedPayload,
  },
];

/**
 * Duplicate of the first milestone event — used to verify idempotency deduplication.
 * Processing this must not create a second timeline entry.
 */
export const duplicateMilestoneEvent: PortalEventEnvelope<MilestoneCompletedPayload> = {
  ...mockEventStream[0],
  event_id: "a1b2c3d4-9999-4abc-8def-duplication-test",
  // idempotency_key is the same — this is the deduplication signal
} as PortalEventEnvelope<MilestoneCompletedPayload>;
