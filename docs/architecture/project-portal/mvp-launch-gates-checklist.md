# MVP Launch Gates Checklist — Project Portal

**Version:** 1.0  
**Sprint:** 22  
**Status:** Sprint 22C implementation foundation landed — validation pending  
**Last updated:** 2026-07-19

Sprint 22 is **complete only when every gate below passes**. Each gate requires a documented artifact and a sign-off from its designated owner.

For gate descriptions, see [`sprint-22-foundation.md`](./sprint-22-foundation.md#7-mvp-launch-gates).

---

## How to Use This Checklist

1. **Owner** is the person or team responsible for satisfying the gate.
2. **Validation method** describes how the gate is verified.
3. **Artifact / evidence** is a link or reference to the proof of passage (PR, test result, document, screenshot).
4. **Pass / fail** is updated by the owner after validation.
5. **Notes** captures blockers, caveats, or deferred items.

A gate may not be marked **Pass** without a completed artifact link.

---

## Launch Gates

### LG-01 — Role Leakage Tests = 0

| Field | Value |
|---|---|
| **Description** | No cross-role data is exposed. A Homeowner cannot see GC-only resources; a GC cannot see internal data. |
| **Owner** | Engineering |
| **Validation method** | Automated role-boundary test suite covering all resource types in the authorization matrix. All tests pass with zero failures. |
| **Artifact / evidence** | `[link to test run]` |
| **Pass / fail** | ☐ Not started |
| **Notes** | — |

---

### LG-02 — Organization Isolation Verified

| Field | Value |
|---|---|
| **Description** | A user in Org A cannot see data from Org B, regardless of role or query parameters. |
| **Owner** | Engineering |
| **Validation method** | Integration tests with two separate orgs, same user. Verify response payloads contain only org-scoped data. Penetration test for param injection (e.g., `?org_id=` override). |
| **Artifact / evidence** | `[link to test run]` |
| **Pass / fail** | ☐ Not started |
| **Notes** | — |

---

### LG-03 — Document Visibility Validated

| Field | Value |
|---|---|
| **Description** | Only customer-facing documents (visibility: "customer") are returned by the portal. Internal documents, draft documents, and internal-tagged documents are never surfaced. |
| **Owner** | Engineering |
| **Validation method** | Unit and integration tests covering each document visibility type. Verify internal docs are filtered at the projection layer, not the client. |
| **Artifact / evidence** | `[link to test run]` |
| **Pass / fail** | ☐ Not started |
| **Notes** | — |

---

### LG-04 — Event Schema Finalized

| Field | Value |
|---|---|
| **Description** | All portal event types defined in [`event-contract-spec.md`](./event-contract-spec.md) have finalized schemas (version 1.0). No open schema questions remain unresolved. |
| **Owner** | Architecture |
| **Validation method** | Event contract spec document approved. JSON schemas generated or documented for all event types. Open Questions in event-contract-spec.md resolved or deferred with explicit decision. |
| **Artifact / evidence** | `docs/architecture/project-portal/event-contract-spec.md`, `docs/architecture/project-portal/sprint-22c-launch-readiness.md`, `src/features/project-portal/runtime/eventValidation.ts` |
| **Pass / fail** | ☐ Not started |
| **Notes** | Schema guardrails, version parking, and deterministic replay hooks are now implemented; final approval is still required. |

---

### LG-05 — Authorization Matrix Approved

| Field | Value |
|---|---|
| **Description** | The authorization matrix in [`authorization-matrix.md`](./authorization-matrix.md) has been reviewed and approved by Product and Engineering. |
| **Owner** | Product + Architecture |
| **Validation method** | Documented approval (PR review sign-off or explicit approval comment) from Product and Engineering leads. Open Questions resolved or deferred with decisions recorded. |
| **Artifact / evidence** | `[link to approval comment or PR review]` |
| **Pass / fail** | ☐ Not started |
| **Notes** | — |

---

### LG-06 — Audit Logging Operational

| Field | Value |
|---|---|
| **Description** | All tracked interactions (login, logout, document viewed, file downloaded, change order acknowledged, invitation accepted, photo viewed) emit audit log entries as defined in the audit policy. |
| **Owner** | Engineering |
| **Validation method** | Integration tests confirm each tracked interaction produces a correctly structured audit log entry. Audit log is immutable — verify no delete/update path exists. |
| **Artifact / evidence** | `[link to test run and audit log sample]` |
| **Pass / fail** | ☐ Not started |
| **Notes** | — |

---

### LG-07 — Mock Event Adapters Implemented

| Field | Value |
|---|---|
| **Description** | Mock event adapters are implemented for all canonical portal event types. The portal UI is fully drivable from mock events without live backend integrations. |
| **Owner** | Engineering |
| **Validation method** | Each event type from the event contract spec has a mock emitter. End-to-end walkthrough confirms all portal screens update correctly from mock events. |
| **Artifact / evidence** | `src/features/project-portal/adapters/types.ts`, `src/features/project-portal/adapters/mockAdapters.ts`, `src/features/project-portal/adapters/fakeAdapters.ts` |
| **Pass / fail** | ☐ Not started |
| **Notes** | Mock and fake adapters now cover Jobs, Daily Plans, Dispatch, Installed Systems, Documents, Photos, Change Orders, and Reporting. |

---

### LG-08 — Portal Navigation Complete

| Field | Value |
|---|---|
| **Description** | All four MVP screens (Project Overview, Timeline, Documents, Contact Team) are reachable via navigation. All routes are defined and functional. No dead links or missing pages. |
| **Owner** | Engineering |
| **Validation method** | Manual walkthrough of complete navigation flow. All routes in routes.ts verified. Deep-link navigation tested. Back navigation tested. |
| **Artifact / evidence** | `[link to navigation walkthrough recording or sign-off]` |
| **Pass / fail** | ☐ Not started |
| **Notes** | — |

---

### LG-09 — Mobile Experience Validated

| Field | Value |
|---|---|
| **Description** | All portal screens are responsive and usable on mobile viewports. All error states and empty states render correctly on mobile. CTAs are accessible by touch. |
| **Owner** | Engineering + Design |
| **Validation method** | Device or emulator testing at 375px (iPhone SE), 390px (iPhone 14), and 414px (large Android) viewports. All eight error states in [`error-state-catalog.md`](./error-state-catalog.md) verified on mobile. |
| **Artifact / evidence** | `[link to device testing screenshots or recording]` |
| **Pass / fail** | ☐ Not started |
| **Notes** | — |

---

### LG-10 — Accessibility Review Completed

| Field | Value |
|---|---|
| **Description** | All portal screens and error states meet WCAG 2.1 AA standards. Keyboard navigation is complete. Screen reader announcements are correct. Color contrast meets minimums. |
| **Owner** | Engineering + Design |
| **Validation method** | Automated accessibility scan (axe-core or equivalent) with zero critical violations. Manual keyboard navigation walkthrough. Screen reader spot-check on error states (ES-01 through ES-06). |
| **Artifact / evidence** | `[link to accessibility scan report]` |
| **Pass / fail** | ☐ Not started |
| **Notes** | — |

---

### LG-11 — P95 Freshness < 5 Minutes (Mock Pipeline)

| Field | Value |
|---|---|
| **Description** | The portal's event projection pipeline processes mock events at P95 latency under 5 minutes. The freshness timestamp updates correctly. |
| **Owner** | Engineering |
| **Validation method** | Load test with mock event emitter at production-representative volume. Measure P95 end-to-end latency from event emission to portal UI update. Verify stale-data banner triggers correctly at >5 min threshold. |
| **Artifact / evidence** | `src/features/project-portal/runtime/checkpoints.ts`, `src/features/project-portal/runtime/rollout.ts`, `docs/architecture/project-portal/sprint-22c-launch-readiness.md` |
| **Pass / fail** | ☐ Not started |
| **Notes** | Freshness thresholds, checkpoint tracking, and rollout hooks are in code; load validation remains pending. |

---

### LG-12 — All Error States Demonstrated

| Field | Value |
|---|---|
| **Description** | Every error and empty state in [`error-state-catalog.md`](./error-state-catalog.md) (ES-01 through ES-08) is demonstrable in the sprint demo. Each state renders the correct copy, CTAs, and telemetry event. |
| **Owner** | Engineering + QA |
| **Validation method** | Structured demo walkthrough triggering each of the 8 error states. Verify user-facing copy matches the catalog. Verify telemetry events are emitted. Verify CTAs are functional. |
| **Artifact / evidence** | `[link to demo recording or QA sign-off]` |
| **Pass / fail** | ☐ Not started |
| **Notes** | — |

---

## Gate Summary

| Gate | Description | Owner | Status |
|---|---|---|---|
| LG-01 | Role leakage tests = 0 | Engineering | ☐ Not started |
| LG-02 | Org isolation verified | Engineering | ☐ Not started |
| LG-03 | Document visibility validated | Engineering | ☐ Not started |
| LG-04 | Event schema finalized | Architecture | ☐ Not started |
| LG-05 | Authorization matrix approved | Product + Architecture | ☐ Not started |
| LG-06 | Audit logging operational | Engineering | ☐ Not started |
| LG-07 | Mock adapters implemented | Engineering | ☐ Not started |
| LG-08 | Portal navigation complete | Engineering | ☐ Not started |
| LG-09 | Mobile experience validated | Engineering + Design | ☐ Not started |
| LG-10 | Accessibility review completed | Engineering + Design | ☐ Not started |
| LG-11 | P95 freshness < 5 min (mock) | Engineering | ☐ Not started |
| LG-12 | All error states demonstrated | Engineering + QA | ☐ Not started |

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ-1 | Is there a formal QA sign-off process, or do engineering owners self-certify? | Process | Open |
| OQ-2 | Are accessibility and mobile gates blocking for Sprint 22 demo, or can they be post-demo? | Product | Open |
| OQ-3 | Does LG-11 (freshness SLA) require a continuous monitoring dashboard, or a one-time test pass? | Engineering | Open |
| OQ-4 | Who is the final approver with authority to declare all 12 gates passed? | Product | Open |
