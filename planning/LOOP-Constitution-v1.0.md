# LOOP Constitution v1.0

## Purpose

This document is the product constitution for LOOP.

It exists to keep future sprints, PR briefs, and product decisions aligned to one durable source of truth.

LOOP is not being built as a collection of disconnected software modules. It is being built as the operating system for field operations.

---

## Mission

LOOP exists to help field service companies run the day with clarity, speed, and operational control.

The product should help owners, dispatchers, office staff, installers, technicians, and managers understand what is happening, what is blocked, and what should happen next.

---

## Vision

LOOP should become the primary operating environment for contractors.

Not the place where records are stored after work happens.

The place where the company orients, plans, dispatches, executes, learns, and improves.

A mature version of LOOP should feel less like a CRM and more like mission control for a living operation.

---

## Product Philosophy

### 1. LOOP is an operations platform, not a CRM

CRMs organize relationships.

LOOP organizes operational reality.

Its center of gravity is the active day: what is scheduled, what is ready, what is moving, what is blocked, and what decision is required now.

### 2. Operations Home is the front door

Operations Home is not another management dashboard.

It is the orientation layer of the company.

It should answer:

- What kind of day is this?
- What requires attention first?
- Where is operational risk building?
- What should this user do next?

### 3. The product is organized around operational moments

LOOP should be framed around moments of work, not generic software categories.

Core moments include:

- Morning Operations — preparing the day
- Live Operations — running the day in motion
- Service and Installation Execution — doing the work
- Follow-through — closing loops, capturing outcomes, and learning

Morning Operations and Live Operations are not separate products. They are phases of the same operational heartbeat.

### 4. Operational state matters more than static records

A company does not run on lists alone. It runs on changing states.

LOOP must make operational state visible and actionable:

- ready
- not ready
- scheduled
- dispatched
- in progress
- blocked
- complete
- unresolved

The product should emphasize transitions, risks, and ownership, not just storage.

---

## Operational Domains

Every feature belongs to exactly one primary domain.

Cross-domain visibility is allowed. Cross-domain ownership is not.

### 1. Operations Home

The company orientation layer.

Purpose:

- summarize operational state
- surface priorities
- direct users into the right workflow
- expose exceptions, bottlenecks, and risk

Operations Home observes all operational domains, but it does not own their records.

### 2. Work Orders

The operational engine of LOOP.

Work Orders are the primary execution object referenced by other domains.

They anchor:

- service work
- install work
- assignment context
- scheduling context
- execution status
- completion outcomes

If a feature needs to know what work is being done, it should usually reference a Work Order.

### 3. Daily Plans

The Morning Operations domain.

Purpose:

- assign crews
- confirm day readiness
- identify gaps before dispatch
- prepare the field operation before the day begins

Daily Plans should optimize for readiness, not long-range scheduling logic.

### 4. Live Operations

The in-motion operating layer.

Purpose:

- show what is happening now
- track progress against milestones
- surface delays, exceptions, and blockers
- increase management awareness without adding noise

Live Operations should optimize for awareness and intervention, not retrospective reporting.

### 5. Scheduling

The planning and coordination domain for time.

Purpose:

- place work on calendars
- coordinate crew and technician availability
- manage capacity and dispatch logic
- support movement of work across time

Scheduling owns time placement. Daily Plans owns day-of readiness.

### 6. Equipment / Assets

The asset context domain.

Assets are distinct from Company.

Purpose:

- represent installed systems
- preserve service history
- carry model, configuration, and context
- support better diagnosis, service, replacement, and planning

Equipment is a product-facing expression of the broader Assets domain.

### 7. Inventory

The material readiness domain.

Purpose:

- show stock visibility
- expose parts readiness
- reduce avoidable delays caused by missing material
- connect operational work to material constraints

Inventory should inform operations without swallowing purchasing or accounting scope prematurely.

### 8. Company

The organization context domain.

Purpose:

- represent the operating entity
- hold business identity, teams, locations, and configuration
- define company-level context used by the rest of the product

Company is not a dumping ground for assets, knowledge, or reporting.

### 9. Company Brain

The knowledge and memory domain.

Purpose:

- observe operations
- capture institutional knowledge
- preserve notes, procedures, and learned context
- make operational knowledge retrievable

Company Brain observes but does not own primary operational data.

The source of truth for schedules, work status, crews, inventory, and assets must remain in their primary domains.

### 10. Reporting

The performance visibility domain.

Purpose:

- turn operational data into patterns
- reveal trend lines and outcomes
- help leadership understand business performance

Reporting should summarize the system. It should not become the system of action.

### 11. AI

The intelligence layer across the platform.

Purpose:

- accelerate understanding
- assist prioritization
- recommend actions
- reduce friction in workflows

AI is a horizontal capability, not a replacement for domain ownership.

---

## Product Laws

These laws should govern future design and implementation decisions.

1. **Every screen must answer: “What should I do next?”**
2. **Information without an action is a design bug.**
3. **Operational data has a single source of truth.**
4. **Every feature belongs to exactly one primary domain.**
5. **Cross-domain views may aggregate data, but they must not duplicate ownership.**
6. **Operational state is a first-class product principle.**
7. **Morning Operations and Live Operations are phases of one system heartbeat.**
8. **Work Orders are the operational engine referenced by surrounding workflows.**
9. **Company Brain can observe, summarize, and assist, but it does not own operational truth.**
10. **AI assists decisions; it never replaces operational ownership.**
11. **If a user cannot tell why something matters now, the product is too abstract.**
12. **If a feature does not improve a decision or action, it does not belong yet.**

---

## UX Principles

### Calm, not cluttered

The product should feel composed under operational pressure.

### Orientation before analysis

Users should understand the current state before being asked to interpret details.

### Action over decoration

Visual hierarchy exists to direct decisions, not to impress.

### State over storage

Show what changed, what is blocked, and what is next.

### Exceptions deserve emphasis

Normal flow should stay quiet. Risk, blockers, and missed expectations should rise to the top.

### Progressive depth

Summary first. Context second. Detail on demand.

### Role-aware usefulness

Owners, dispatchers, technicians, and managers do not need the same first answer.

Interfaces should adapt around the decision each role is making.

---

## Architecture Principles

### Product architecture mirrors operational architecture

The product structure should reflect how the business runs, not how a database is easiest to model.

### Pages assemble domains; domains own logic

Business logic should live in the domain that owns the problem.

### Shared components should stay generic

Reusable UI elements must not absorb domain logic.

### State transitions should be explicit

When operational status changes, the owning domain should make that transition legible.

### Read models and action models should stay intentional

Dashboards, summaries, and AI views may compose information from many places.

The write path must remain clear and owned.

### Documentation is part of architecture

If teams cannot tell where new work belongs, the architecture is incomplete.

---

## Naming Conventions

### Product-facing names

Use names that describe the operational moment or domain the user understands.

Preferred examples:

- Operations Home
- Daily Plans
- Live Operations
- Work Orders
- Equipment
- Inventory
- Company Brain
- Reporting

Avoid generic internal-language product names such as:

- Dashboard
- Admin Center
- Data Hub
- Records
- Module Manager

### Internal domain language

Internal naming should preserve clear separation between domain concepts and UI labels.

Examples:

- `operations-home` may power the user-facing “Operations Home”
- `assets` may contain product-facing “Equipment” workflows
- `company-brain` may power product-facing “Company Brain” experiences

### Naming test for future work

A proposed feature name should make three things obvious:

1. what part of the operation it belongs to
2. who immediately understands its purpose
3. what kind of decision or action it supports

If the name sounds like software instead of work, rename it.

---

## Product State Model

Operational state is the backbone of LOOP.

### System heartbeat

The platform should be understood as a daily operational loop:

1. **Orient** — understand the day and current risk
2. **Prepare** — confirm readiness, crews, materials, and prerequisites
3. **Dispatch** — commit work into motion
4. **Execute** — track progress, blockers, and field reality
5. **Resolve** — complete work, clear exceptions, record outcomes
6. **Learn** — preserve context, expose patterns, improve future decisions

Morning Operations primarily strengthens Orient and Prepare.

Live Operations primarily strengthens Dispatch and Execute.

Reporting and Company Brain help Resolve and Learn without taking ownership away from the execution domains.

### Work Order lifecycle

The default operational object should move through a visible lifecycle such as:

- created
- scoped
- scheduled
- ready
- dispatched
- in progress
- blocked
- completed
- verified
- closed

Not every workflow will expose every state in the same way, but state progression must remain legible.

### Ownership model

- Work Orders own execution status
- Scheduling owns time placement and capacity coordination
- Daily Plans own day-of readiness decisions
- Live Operations owns real-time visibility and intervention context
- Inventory owns material availability truth
- Assets own equipment/system history and context
- Company Brain owns knowledge artifacts, not operational facts
- Reporting owns derived metrics, not primary records

---

## Decision Framework For Future Features

Every proposed feature, sprint, or PR should answer the following before implementation begins.

### 1. What domain does it belong to?

Choose one primary domain.

If the feature seems to belong to many domains, the concept is still too blurry.

### 2. Who is the primary user?

Name the first user who benefits:

- owner
- dispatcher
- office staff
- technician
- installer
- manager
- sales team

Secondary audiences may exist, but one primary user must anchor the workflow.

### 3. What decision or action does it improve?

A feature should improve a real operational move such as:

- assign the right crew
- spot risk before dispatch
- re-route delayed work
- understand service history on site
- verify parts readiness
- identify performance drift

### 4. What operational moment does it strengthen?

Map the feature to:

- Orient
- Prepare
- Dispatch
- Execute
- Resolve
- Learn

### 5. What data does it own, and what data does it only reference?

Ownership must be explicit.

If ownership is ambiguous, the design is not ready.

### 6. What boundary must not be crossed yet?

Every sprint should be allowed to focus.

Define what the feature is intentionally not doing so adjacent domains do not blur together prematurely.

---

## AI Philosophy

AI in LOOP should increase leverage, not reduce accountability.

AI should help teams:

- understand situations faster
- find relevant context
- detect likely risks
- recommend next steps
- summarize patterns and history
- reduce repetitive operational overhead

AI should not:

- silently mutate operational truth
- replace explicit ownership of schedules, status, or inventory
- obscure why a recommendation was made
- become the only path to understanding the system

The right model is copilot, not autopilot.

---

## Roadmap Philosophy

The roadmap should build LOOP in the same order a real operation becomes legible.

That generally means:

1. establish orientation
2. establish readiness
3. establish live visibility
4. establish asset and material context
5. strengthen coordination logic
6. preserve institutional memory
7. expose performance patterns
8. layer intelligence across the system

Roadmap sequencing should favor operational coherence over feature quantity.

A sprint is successful when it makes the platform more usable as an operating system, not when it adds the most surface area.

---

## Practical Execution Guidance

### How future PR briefs should reference this constitution

Each future implementation brief should explicitly state:

- primary domain
- primary user
- operational moment improved
- source-of-truth data owner
- adjacent domains intentionally out of scope
- success criteria stated as improved decisions or actions

### How to decide where a new feature belongs

Use this order:

1. identify the operational decision
2. identify the user making it
3. identify the record that owns the truth
4. place the feature in that domain
5. allow other domains to reference it secondarily if needed

### Naming guidance for future planning

- Use operational names for user-facing modules
- Use domain names for internal architecture
- Avoid naming features after technical implementation details
- Prefer names that imply motion, ownership, or purpose

---

## Final Standard

LOOP should help a contractor run the business, not merely document it.

If a future feature does not make the operation clearer, faster, or more controllable in the moment that matters, it should be rethought before it is built.
