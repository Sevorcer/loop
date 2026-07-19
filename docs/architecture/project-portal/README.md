# Project Portal — Architecture Documentation

**Sprint:** 22  
**Domain:** Project Portal  
**Owned Truth:** Project Transparency  
**Status:** Foundation — architecture and planning only. No live integration implemented.

---

## What Is This

This folder contains the architecture and planning foundation for LOOP's **Project Portal** — the secure, role-aware, read-only external interface that gives customers, general contractors, builders, and property managers self-service visibility into their projects.

These documents define the security model, role permissions, event contracts, error behaviors, and launch requirements. They are the authoritative reference for implementation.

---

## Files in This Folder

| File | Purpose |
|---|---|
| [`sprint-22-foundation.md`](./sprint-22-foundation.md) | Master sprint document. Domain definition, product principles, role-based experiences, all architecture hardening sections, domain boundaries, MVP scope, deliverables, and definition of done. **Start here.** |
| [`authorization-matrix.md`](./authorization-matrix.md) | Role/permission matrix. Defines what each role can see and do, deny rules for internal artifacts, precedence rules for multi-role users, tenancy boundary enforcement, and concrete conflict examples. |
| [`event-contract-spec.md`](./event-contract-spec.md) | Canonical event envelope definition. Field constraints, versioning policy, replay expectations, ordering guarantees, deduplication logic, portal projection processing rules, stale-data behavior, and sample events for all MVP event types. |
| [`error-state-catalog.md`](./error-state-catalog.md) | Complete catalog of critical error and empty states. Every state includes trigger condition, user-facing copy, CTAs, telemetry event name, severity, recoverability, accessibility notes, and mobile behavior. |
| [`mvp-launch-gates-checklist.md`](./mvp-launch-gates-checklist.md) | Implementation and QA checklist for all 12 MVP launch gates. Each gate has an owner, validation method, artifact evidence placeholder, and pass/fail field. Sprint 22 is not complete until all gates pass. |

---

## Recommended Read Order

1. **`sprint-22-foundation.md`** — Understand the domain, goal, and constraints before reading anything else.
2. **`authorization-matrix.md`** — Understand the security model and role boundaries.
3. **`event-contract-spec.md`** — Understand how portal state is built from events.
4. **`error-state-catalog.md`** — Understand every failure mode and its designed response.
5. **`mvp-launch-gates-checklist.md`** — Understand what must be true before Sprint 22 closes.

---

## How Engineering Should Use These Docs

- Use `sprint-22-foundation.md` to understand the full scope before writing any code.
- Use `authorization-matrix.md` as the spec for all server-side permission checks. Do not improvise role logic.
- Use `event-contract-spec.md` as the contract for mock adapter implementation. All event shapes must match the defined envelopes.
- Use `error-state-catalog.md` to implement every error state before the sprint demo. No state may be left as a blank page or unhandled exception.
- Use `mvp-launch-gates-checklist.md` to track progress and provide artifact evidence for each gate. Engineering owns LG-01 through LG-03, LG-06 through LG-09, and LG-11.

---

## How QA Should Use These Docs

- Use `authorization-matrix.md` to write role-boundary and tenancy-isolation test cases.
- Use `event-contract-spec.md` to validate mock event payloads against the defined schema.
- Use `error-state-catalog.md` to build a structured test plan covering all 8 error states on desktop and mobile.
- Use `mvp-launch-gates-checklist.md` to track sign-off status and link test artifacts to each gate.

---

## How Product Should Use These Docs

- Use `sprint-22-foundation.md` as the source of truth for scope: what is in MVP and what is deferred.
- Use `authorization-matrix.md` to review and approve role decisions (LG-05 requires Product sign-off).
- Use `error-state-catalog.md` to review user-facing copy for all error and empty states.
- Use `mvp-launch-gates-checklist.md` to monitor sprint completion status.

---

## Important Notes

- **This is architecture and planning only.** No live backend integration exists in Sprint 22.
- All event adapters in Sprint 22 are **mock adapters** — no production data pipelines are wired.
- All portal state in Sprint 22 is derived from **mock data** that conforms to the event contract spec.
- The security model and event contracts defined here are production-ready and must be implemented without deviation when live integration begins.
- The `Open Questions` section at the end of each file tracks unresolved decisions. These must be resolved before live integration begins.

---

## Relationship to Other Docs

| Document | Relationship |
|---|---|
| `docs/architecture.md` | Overall LOOP architecture — Project Portal is a new domain added in Sprint 22. |
| `docs/atlas.md` | ATLAS design system — Portal UI components must follow ATLAS tokens and design language. |
| `planning/Roadmap-Alignment-Sprints-15-22.md` | Sprint roadmap context — Sprint 22 is the Project Portal foundation sprint. |
| `planning/LOOP-Constitution-v1.0.md` | Product constitution — Portal principles must align with LOOP's core product values. |
