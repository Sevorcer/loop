# Event Contract Specification — Project Portal

**Version:** 1.0  
**Sprint:** 22  
**Status:** Draft — pending finalization  
**Last updated:** 2026-07-19

This document defines the canonical event contract for portal projection events. The Project Portal is a read-only projection; it receives events from operational domains and uses them to update its view of project state.

For the overview of event-driven architecture and the list of subscribing event types, see [`sprint-22-foundation.md`](./sprint-22-foundation.md).

---

## Design Principles

1. The portal never writes to source domains. Events flow in one direction: source domain → portal projection.
2. Events are the single source of truth for portal state updates.
3. Every event must be idempotent. Processing the same event twice must not corrupt state.
4. Events support full replay from the beginning of the stream.
5. The portal tolerates delayed or out-of-order events gracefully.

---

## Canonical Event Envelope

Every event published for portal consumption must conform to this envelope:

```json
{
  "event_id": "string",
  "event_version": "string",
  "event_type": "string",
  "occurred_at": "string (ISO-8601)",
  "source_domain": "string",
  "aggregate_id": "string",
  "idempotency_key": "string",
  "payload": {}
}
```

---

## Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | `string` | ✓ | Globally unique identifier for this specific event instance. Format: UUID v4. |
| `event_version` | `string` | ✓ | Semantic version of the event schema. Format: `MAJOR.MINOR` (e.g., `"1.0"`). Must be incremented on breaking changes. |
| `event_type` | `string` | ✓ | Dot-separated domain event name. Format: `<aggregate>.<verb>` (e.g., `milestone.completed`). Lowercase. |
| `occurred_at` | `string` | ✓ | ISO-8601 UTC timestamp of when the domain event occurred. Format: `YYYY-MM-DDTHH:MM:SS.sssZ`. Must not be the processing time. |
| `source_domain` | `string` | ✓ | Canonical identifier of the originating domain. Values: `jobs`, `dispatch`, `daily-plans`, `documents`, `photos`, `change-orders`, `installed-systems`. |
| `aggregate_id` | `string` | ✓ | Identifier of the primary aggregate the event describes (e.g., project ID, job ID). Format: UUID v4. |
| `idempotency_key` | `string` | ✓ | Stable key used by the portal to deduplicate events. Format: `<source_domain>:<event_type>:<aggregate_id>:<occurred_at>`. Must be deterministic and repeatable across replays. |
| `payload` | `object` | ✓ | Event-type-specific data. Schema defined per event type below. May be empty object `{}` but must not be null. |

---

## Field Constraints

### `event_id`

- Must be globally unique across all events from all domains.
- UUID v4 format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- Must never be reused, even during replay. Replay generates new `event_id` values.

### `event_version`

- Format: `MAJOR.MINOR` string (e.g., `"1.0"`, `"1.1"`, `"2.0"`).
- **Minor bump:** additive payload fields — backward compatible.
- **Major bump:** breaking payload changes — portal must handle version mismatch gracefully (log and skip unknown versions until updated).
- Portal projection processors must inspect `event_version` before processing.

### `occurred_at`

- Must reflect domain-side event occurrence time, not ingestion or processing time.
- Must be UTC.
- Precision: milliseconds minimum.
- The portal orders timeline entries by `occurred_at`, not by ingestion order.

### `idempotency_key`

- Constructed as: `<source_domain>:<event_type>:<aggregate_id>:<occurred_at>`
- Example: `jobs:milestone.completed:a1b2c3d4-...:2026-07-19T14:30:00.000Z`
- The portal stores processed idempotency keys. If a key is already present, the event is acknowledged and discarded without reprocessing.
- Idempotency keys are immutable once emitted.

### `payload`

- Must be a valid JSON object.
- May be empty `{}` for events with no additional data.
- Must not contain fields classified as internal-only (see [`authorization-matrix.md`](./authorization-matrix.md#deny-rules--internal-only-artifacts)).
- Payload schemas are versioned independently via `event_version`.

---

## Versioning Policy

| Change Type | Version Bump | Portal Action |
|---|---|---|
| New optional payload field | Minor | Accept; ignore unknown fields |
| New required payload field | Major | Portal update required before accepting |
| Field rename | Major | Portal update required |
| Field removal | Major | Portal update required |
| `event_type` rename | Major (new type) | Old type deprecated; both emitted during transition |
| `source_domain` change | Major | Portal update required |

**Deprecation rule:** Old event types or versions are supported for a minimum of 2 sprints after the new version is released. Deprecation is announced via the engineering changelog.

---

## Replay Expectations

- Every source domain must support full-history replay of events for a given `aggregate_id`.
- During replay, `event_id` values are regenerated (new UUIDs).
- During replay, `idempotency_key` values are identical to original emission — this is what enables safe deduplication.
- The portal may request a replay for a specific `aggregate_id` to rebuild stale or corrupted state.
- Replay events are indistinguishable from live events except by an optional `replay: true` metadata flag (non-required).

---

## Ordering Guarantees

The portal **does not assume strict delivery ordering**. Events may arrive out of order due to network conditions or replay.

Ordering rules:

- The portal uses `occurred_at` to determine chronological event order.
- If two events for the same `aggregate_id` have the same `occurred_at`, processing order is implementation-defined (last-write-wins within the same timestamp).
- Late-arriving events (events with `occurred_at` earlier than the last processed event for an aggregate) are applied if they are not already in the processed idempotency key store.
- The portal must never discard a valid late-arriving event; it must apply it at its correct `occurred_at` position in the timeline.

---

## Deduplication Logic

```
1. Receive event.
2. Compute expected idempotency_key: <source_domain>:<event_type>:<aggregate_id>:<occurred_at>
3. Check idempotency key store for this key.
4. If found: ACK the event, do NOT reprocess. Return.
5. If not found: process the event, write projection update.
6. Store the idempotency key as processed.
7. ACK the event.
```

The idempotency key store is append-only. Keys are never deleted.

---

## Portal Projection Processing Rules

1. **Validate envelope:** All required fields present and correctly formatted. If invalid, the event is logged as malformed and sent to a dead-letter queue.
2. **Check event_version:** If version is unknown (future major version), the event is logged and held in a pending queue until the portal is updated.
3. **Deduplicate:** Apply deduplication logic above.
4. **Apply authorization filter:** Events referencing projects outside the portal's scope are ignored.
5. **Map to projection:** Transform payload to portal projection state update.
6. **Write projection update:** Atomic write to portal state store.
7. **Update freshness timestamp:** Record `processed_at` for the affected aggregate.

---

## Sprint 22C Implementation Alignment

The current implementation foundation for these rules lives in:

- `src/features/project-portal/runtime/eventValidation.ts`
- `src/features/project-portal/runtime/idempotency.ts`
- `src/features/project-portal/runtime/checkpoints.ts`
- `src/features/project-portal/runtime/replayHarness.ts`

These modules enforce envelope validation, version parking, deduplication, checkpoint capture, and deterministic replay against the read-only adapter layer described in [`sprint-22c-launch-readiness.md`](./sprint-22c-launch-readiness.md).

---

## Stale-Data Behavior

If events are delayed beyond the freshness SLA (P95 < 5 minutes):

| Condition | Portal Behavior |
|---|---|
| Age of last event < 5 min | No banner. Normal operation. |
| Age of last event 5–15 min | Show stale-data banner: "Information may be outdated. Last synchronized X minutes ago." |
| Age of last event > 15 min | Show elevated stale-data banner with support contact link. Continue serving cached data. |
| Event stream unavailable | Show service disruption banner. Serve last known good state. Log `portal.feed.stale` telemetry event. |

**Never** display partial state updates. If an event batch is incomplete, serve the last complete known state with the stale banner until the batch is fully applied.

---

## Sample Events

### `milestone.completed`

```json
{
  "event_id": "a1b2c3d4-0001-4abc-8def-000000000001",
  "event_version": "1.0",
  "event_type": "milestone.completed",
  "occurred_at": "2026-07-19T14:30:00.000Z",
  "source_domain": "jobs",
  "aggregate_id": "proj-0001-uuid",
  "idempotency_key": "jobs:milestone.completed:proj-0001-uuid:2026-07-19T14:30:00.000Z",
  "payload": {
    "milestone_id": "ms-0001-uuid",
    "milestone_name": "Rough-In Complete",
    "milestone_sequence": 6,
    "completed_by": "Project Manager",
    "notes_for_portal": "Rough-in inspection scheduled for next week.",
    "project_id": "proj-0001-uuid"
  }
}
```

### `appointment.scheduled`

```json
{
  "event_id": "b2c3d4e5-0002-4abc-8def-000000000002",
  "event_version": "1.0",
  "event_type": "appointment.scheduled",
  "occurred_at": "2026-07-19T09:00:00.000Z",
  "source_domain": "dispatch",
  "aggregate_id": "proj-0001-uuid",
  "idempotency_key": "dispatch:appointment.scheduled:proj-0001-uuid:2026-07-19T09:00:00.000Z",
  "payload": {
    "appointment_id": "appt-0002-uuid",
    "project_id": "proj-0001-uuid",
    "scheduled_date": "2026-07-22",
    "scheduled_window": "08:00–12:00",
    "appointment_type": "Installation",
    "contact_name": "Project Manager",
    "contact_phone": "555-000-0000"
  }
}
```

### `change_order.approved`

```json
{
  "event_id": "c3d4e5f6-0003-4abc-8def-000000000003",
  "event_version": "1.0",
  "event_type": "change_order.approved",
  "occurred_at": "2026-07-18T16:45:00.000Z",
  "source_domain": "change-orders",
  "aggregate_id": "proj-0001-uuid",
  "idempotency_key": "change-orders:change_order.approved:proj-0001-uuid:2026-07-18T16:45:00.000Z",
  "payload": {
    "change_order_id": "co-0003-uuid",
    "project_id": "proj-0001-uuid",
    "change_order_number": "CO-007",
    "title": "Thermostat Upgrade to Smart Control",
    "approved_amount_cents": 29900,
    "currency": "USD",
    "approved_at": "2026-07-18T16:45:00.000Z",
    "effective_date": "2026-07-22"
  }
}
```

### `document.published`

```json
{
  "event_id": "d4e5f6a7-0004-4abc-8def-000000000004",
  "event_version": "1.0",
  "event_type": "document.published",
  "occurred_at": "2026-07-17T11:00:00.000Z",
  "source_domain": "documents",
  "aggregate_id": "proj-0001-uuid",
  "idempotency_key": "documents:document.published:proj-0001-uuid:2026-07-17T11:00:00.000Z",
  "payload": {
    "document_id": "doc-0004-uuid",
    "project_id": "proj-0001-uuid",
    "document_name": "Inspection Report — Rough-In",
    "document_type": "inspection_report",
    "visibility": "customer",
    "file_size_bytes": 204800,
    "mime_type": "application/pdf",
    "published_at": "2026-07-17T11:00:00.000Z"
  }
}
```

> **Note:** `visibility: "customer"` is the only value the portal projection should process. Documents with `visibility: "internal"` must be filtered out server-side before reaching the portal projection layer.

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ-1 | What is the transport mechanism for portal events? (Message queue, webhook, polling?) | Engineering | Open |
| OQ-2 | Is there a maximum payload size limit per event? | Engineering | Open |
| OQ-3 | Should `notes_for_portal` be a standard payload field across all event types, or event-specific? | Architecture | Open |
| OQ-4 | How should the portal handle schema validation failures — dead-letter queue, retry, or discard? | Engineering | Open |
| OQ-5 | What is the retention period for the processed idempotency key store? | Engineering | Open |
| OQ-6 | Does `appointment.scheduled` need to include a cancellation flag, or is `appointment.cancelled` a separate event type? | Architecture | Open |
