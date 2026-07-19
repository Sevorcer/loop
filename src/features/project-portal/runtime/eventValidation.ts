import {
  PORTAL_CANONICAL_EVENT_TYPES,
  PORTAL_SUPPORTED_EVENT_VERSIONS,
  type PortalEventEnvelope,
  type PortalEventValidationError,
  type PortalEventValidationResult,
} from "../types/events";
import type { PortalSourceDomain } from "../types/integration";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION_PATTERN = /^\d+\.\d+$/;
const EVENT_TYPE_PATTERN = /^[a-z]+(?:_[a-z]+)?\.[a-z]+(?:_[a-z]+)?$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const SOURCE_DOMAINS: PortalSourceDomain[] = [
  "jobs",
  "daily-plans",
  "dispatch",
  "installed-systems",
  "documents",
  "photos",
  "change-orders",
  "reporting",
];

export interface PortalEventValidationOptions {
  supportedVersions?: readonly string[];
}

function expectedIdempotencyKey(event: PortalEventEnvelope) {
  return `${event.source_domain}:${event.event_type}:${event.aggregate_id}:${event.occurred_at}`;
}

function reject(
  event: PortalEventEnvelope | null,
  errors: PortalEventValidationError[]
): PortalEventValidationResult {
  return { status: "rejected", event, errors };
}

function park(
  event: PortalEventEnvelope,
  errors: PortalEventValidationError[]
): PortalEventValidationResult {
  return { status: "parked", event, errors };
}

export function validatePortalEventEnvelope(
  rawEvent: unknown,
  options: PortalEventValidationOptions = {}
): PortalEventValidationResult {
  const supportedVersions =
    options.supportedVersions ?? PORTAL_SUPPORTED_EVENT_VERSIONS;

  if (!rawEvent || typeof rawEvent !== "object") {
    return reject(null, [
      {
        code: "payload_not_object",
        severity: "reject",
        message: "Event envelope must be an object.",
      },
    ]);
  }

  const event = rawEvent as PortalEventEnvelope;
  const missingFields = [
    "event_id",
    "event_version",
    "event_type",
    "occurred_at",
    "source_domain",
    "aggregate_id",
    "idempotency_key",
    "payload",
  ].filter((field) => event[field as keyof PortalEventEnvelope] === undefined);

  if (missingFields.length > 0) {
    return reject(event, [
      {
        code: "missing_field",
        severity: "reject",
        message: `Missing required event field(s): ${missingFields.join(", ")}.`,
        details: { missingFields },
      },
    ]);
  }

  if (!UUID_V4_PATTERN.test(event.event_id)) {
    return reject(event, [
      {
        code: "invalid_uuid",
        severity: "reject",
        message: "event_id must be a UUID v4.",
        field: "event_id",
      },
    ]);
  }

  if (!VERSION_PATTERN.test(event.event_version)) {
    return reject(event, [
      {
        code: "invalid_version_format",
        severity: "reject",
        message: 'event_version must follow the MAJOR.MINOR format (for example "1.0").',
        field: "event_version",
      },
    ]);
  }

  if (!EVENT_TYPE_PATTERN.test(event.event_type)) {
    return reject(event, [
      {
        code: "unknown_event_type",
        severity: "reject",
        message: "event_type must use the canonical <aggregate>.<verb> lowercase format.",
        field: "event_type",
      },
    ]);
  }

  if (!ISO_DATE_PATTERN.test(event.occurred_at) || Number.isNaN(Date.parse(event.occurred_at))) {
    return reject(event, [
      {
        code: "invalid_timestamp",
        severity: "reject",
        message: "occurred_at must be a valid ISO-8601 UTC timestamp.",
        field: "occurred_at",
      },
    ]);
  }

  if (!SOURCE_DOMAINS.includes(event.source_domain)) {
    return reject(event, [
      {
        code: "invalid_source_domain",
        severity: "reject",
        message: `source_domain must be one of: ${SOURCE_DOMAINS.join(", ")}.`,
        field: "source_domain",
      },
    ]);
  }

  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    return reject(event, [
      {
        code: "payload_not_object",
        severity: "reject",
        message: "payload must be a JSON object and may not be null.",
        field: "payload",
      },
    ]);
  }

  const expectedKey = expectedIdempotencyKey(event);
  if (event.idempotency_key !== expectedKey) {
    return reject(event, [
      {
        code: "invalid_idempotency_key",
        severity: "reject",
        message: "idempotency_key must match the canonical deterministic format.",
        field: "idempotency_key",
        details: { expected: expectedKey, actual: event.idempotency_key },
      },
    ]);
  }

  if (!PORTAL_CANONICAL_EVENT_TYPES.includes(event.event_type as (typeof PORTAL_CANONICAL_EVENT_TYPES)[number])) {
    return park(event, [
      {
        code: "unknown_event_type",
        severity: "park",
        message: "Event type is well-formed but not yet recognized by the portal projection runtime.",
        field: "event_type",
      },
    ]);
  }

  if (!supportedVersions.includes(event.event_version)) {
    return park(event, [
      {
        code: "unsupported_version",
        severity: "park",
        message:
          "Event version is not currently supported. The event should remain parked until the runtime is upgraded.",
        field: "event_version",
        details: { supportedVersions },
      },
    ]);
  }

  return {
    status: "accepted",
    event,
    warnings: [],
  };
}
