# Sprint 22C — Integration Adapters, Contract Guardrails, and Launch Readiness

**Version:** 1.0  
**Sprint:** 22C  
**Status:** Implementation-ready foundation landed  
**Last updated:** 2026-07-19

Sprint 22C closes the gap between architecture-only Project Portal docs and a production-safe integration foundation. The portal remains a **read-only projection** while upstream domains continue to own operational truth.

---

## Implementation Artifacts

| Capability | Source files |
|---|---|
| Adapter contracts for Jobs, Daily Plans, Dispatch, Installed Systems, Documents, Photos, Change Orders, Reporting | `src/features/project-portal/adapters/types.ts` |
| Mock adapters wired to existing LOOP mock domain data | `src/features/project-portal/adapters/mockAdapters.ts` |
| Fake in-memory adapters for deterministic contract/replay scenarios | `src/features/project-portal/adapters/fakeAdapters.ts`, `src/features/project-portal/data/fakePortalArtifacts.ts` |
| Event envelope validation and version guardrails | `src/features/project-portal/runtime/eventValidation.ts` |
| Idempotency / deduplication guard by `idempotency_key` | `src/features/project-portal/runtime/idempotency.ts` |
| Projection checkpoint + stale-data safeguards | `src/features/project-portal/runtime/checkpoints.ts` |
| Projection snapshot assembly and read-only mapping | `src/features/project-portal/runtime/projection.ts` |
| Deterministic replay harness for projection rebuilds | `src/features/project-portal/runtime/replayHarness.ts` |
| Rollout controls and observability hooks | `src/features/project-portal/runtime/rollout.ts` |
| Public feature surface for future UI/runtime adoption | `src/features/project-portal/index.ts` |

---

## Adapter Contract Decisions

### Upstream domains covered

- Jobs
- Daily Plans
- Dispatch
- Installed Systems
- Documents
- Photos
- Change Orders
- Reporting

### Rules enforced by the contracts

1. Every adapter is explicitly **read-only**.
2. Transport access (`fetchProjectRecords`, `fetchEvents`) is separated from projection mapping.
3. The portal consumes normalized upstream records rather than reaching into feature-state internals.
4. Mock adapters and fake adapters implement the same interfaces so replay and validation logic can run without live infrastructure.

---

## Event Contract Guardrails

Implemented runtime behavior:

- Required envelope field validation for:
  - `event_id`
  - `event_version`
  - `event_type`
  - `occurred_at`
  - `source_domain`
  - `aggregate_id`
  - `idempotency_key`
  - `payload`
- UUID v4, semantic version, lowercase event-type, ISO-8601 UTC, and deterministic idempotency-key checks
- Unknown but well-formed event types are **parked**
- Unknown or newer event versions are **parked**
- Malformed events are **rejected** with structured error payloads
- Duplicate events are acknowledged without reprocessing through append-only idempotency tracking

This aligns the implementation with the contract rules in [`event-contract-spec.md`](./event-contract-spec.md).

---

## Projection Reliability Safeguards

Sprint 22C adds the reliability primitives needed before live integrations:

- **Checkpoint store abstraction** for last known good projection state
- **Checkpoint history** to support rollback after bad event application
- **Freshness classifier** for the stale-data SLA thresholds documented in Sprint 22
- **Replay harness** that orders events by `occurred_at` and deterministic `idempotency_key`
- **Safe fallback behavior** that preserves the last good checkpoint when the feed is unavailable or events fail validation

---

## Rollout Controls and Observability Hooks

The runtime now exposes:

- capability flags for ingestion, projection rebuilds, stale-data banners, document publishing, photo publishing, and reporting metrics
- launch-gate status hooks keyed to `LG-01` through `LG-12`
- in-memory telemetry sink for:
  - rejected events
  - parked events
  - duplicate events
  - future integration of `portal.feed.stale` and other launch telemetry

These controls are intentionally lightweight so the same contracts can back local demos, contract tests, and later production adapters.

---

## Launch Gate Mapping

| Gate | Sprint 22C closure |
|---|---|
| LG-04 — Event schema finalized | Runtime validator enforces the shared envelope and supported-version policy. |
| LG-07 — Mock event adapters implemented | Mock and fake adapters now exist for every upstream domain in scope. |
| LG-11 — P95 freshness < 5 min (mock) | Freshness thresholds and checkpoint tracking now exist in code for load and SLA validation. |
| LG-12 — All error states demonstrated | Runtime now distinguishes rejected, parked, duplicate, stale, and disrupted projection conditions. |

Remaining launch gates still require explicit validation runs, approvals, or UI demonstrations before they can be marked passed.

---

## Next Validation Steps

1. Wire the feature module into the eventual portal UI runtime.
2. Add automated role-boundary, org-isolation, and document-visibility tests against the adapter/mapping layer.
3. Exercise the replay harness with load-shaped event fixtures to capture P95 freshness evidence.
4. Connect the telemetry sink to the production observability pipeline when live integrations begin.
