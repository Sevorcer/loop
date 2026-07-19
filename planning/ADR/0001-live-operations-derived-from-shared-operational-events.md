# ADR 0001: Derive Live Operations from Shared Operational Events

- Status: Accepted
- Date: 2026-07-19

## Context

Sprint 16 Live Operations clarified an architectural lesson: the workspace is most coherent when it behaves like one operational system rather than a page of unrelated widgets.

Hero summaries, Decision Feed, Needs Attention, Operational Timeline, and Operational Health should, wherever practical, derive from the same underlying operational event model so the workspace tells one consistent story about the state of the day.

This does not require full event sourcing or backend streaming yet. The near-term implementation should stay local-first, practical, and easy to evolve.

The purpose is coherence, consistency, and a single source of operational truth.

This decision is grounded in three product laws:

- Attention is a finite resource.
- Every operational change creates an event.
- Every event should either inform, escalate, or resolve.

## Decision

- Represent meaningful operational changes as operational events.
- Derive major Live Operations views from shared event data wherever practical instead of letting each section invent separate business logic.
- Keep the system explainable by basing operational health on obvious facts such as delays, active exceptions, blocked crews, and jobs behind milestone.
- Avoid premature scoring complexity, full event-sourcing infrastructure, or streaming architecture until the product actually needs them.

## Alternatives Considered

### 1. Build each Live Operations section independently with its own derived logic

- Simpler short-term implementation.
- Higher long-term drift risk.
- More likely to produce inconsistent hero, timeline, attention, decision, and health behavior.

### 2. Introduce a full event-sourcing or streaming architecture immediately

- Too heavy for the current product stage.
- Unnecessary before real integrations and backends exist.
- Adds infrastructure complexity before the product has validated the model.

## Consequences

### Benefits

- Timeline, attention, decision, and health views stay consistent because they derive from the same operational truth.
- Future evolution into notifications, activity history, Company Brain learning, BI, and auditing becomes easier.
- Live Operations feels like one product behavior across operational moments instead of a collection of widgets.

### Tradeoffs

- Requires some upfront discipline when modeling operational states and event types.
- Adding new operational states now needs slightly more care so new events remain useful, explainable, and reusable across views.
