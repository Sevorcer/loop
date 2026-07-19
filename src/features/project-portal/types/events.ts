import type { PortalSourceDomain } from "./portal";

export const PORTAL_SUPPORTED_EVENT_VERSIONS = ["1.0"] as const;

export const PORTAL_CANONICAL_EVENT_TYPES = [
  "milestone.completed",
  "inspection.scheduled",
  "inspection.completed",
  "appointment.scheduled",
  "appointment.updated",
  "crew.dispatched",
  "crew.arrived",
  "installation.completed",
  "startup.completed",
  "change_order.approved",
  "document.published",
  "photo.uploaded",
] as const;

export type SupportedPortalEventVersion =
  (typeof PORTAL_SUPPORTED_EVENT_VERSIONS)[number];

export type PortalCanonicalEventType =
  (typeof PORTAL_CANONICAL_EVENT_TYPES)[number];

export interface PortalEventEnvelope<
  Payload extends Record<string, unknown> = Record<string, unknown>,
> {
  event_id: string;
  event_version: string;
  event_type: string;
  occurred_at: string;
  source_domain: PortalSourceDomain;
  aggregate_id: string;
  idempotency_key: string;
  payload: Payload;
  replay?: boolean;
}

export type PortalEventValidationSeverity = "reject" | "park" | "warn";

export type PortalEventValidationCode =
  | "missing_field"
  | "invalid_uuid"
  | "invalid_version_format"
  | "unsupported_version"
  | "unknown_event_type"
  | "invalid_timestamp"
  | "invalid_source_domain"
  | "invalid_idempotency_key"
  | "payload_not_object"
  | "duplicate_event";

export interface PortalEventValidationError {
  code: PortalEventValidationCode;
  severity: PortalEventValidationSeverity;
  message: string;
  field?: keyof PortalEventEnvelope | "payload";
  details?: Record<string, unknown>;
}

export interface AcceptedPortalEvent {
  status: "accepted";
  event: PortalEventEnvelope;
  warnings: PortalEventValidationError[];
}

export interface ParkedPortalEvent {
  status: "parked";
  event: PortalEventEnvelope | null;
  errors: PortalEventValidationError[];
}

export interface RejectedPortalEvent {
  status: "rejected";
  event: PortalEventEnvelope | null;
  errors: PortalEventValidationError[];
}

export type PortalEventValidationResult =
  | AcceptedPortalEvent
  | ParkedPortalEvent
  | RejectedPortalEvent;
