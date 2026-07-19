# Roadmap Alignment — Sprints 15-22

## Purpose

This document translates `planning/LOOP-Constitution-v1.0.md` into execution guidance for the next planning sequence.

It exists to keep sprint scopes aligned to operational domains, operational moments, and product laws.

---

## How to use this document

For each sprint, future planning briefs should confirm:

- the primary domain being strengthened
- the product moment being improved
- the boundaries that keep the sprint focused
- the product-level definition of success

A sprint should not be scoped by surface area alone.

It should be scoped by what operational capability becomes clearer or more reliable when the sprint is done.

---

## Sprint 15 — Daily Plans

### Constitution mapping

- Primary domain: Daily Plans
- Supporting domains referenced: Work Orders, Scheduling, Inventory, Company
- Primary user: dispatcher, operations manager, lead coordinator
- Operational moment: Morning Operations / Prepare

This sprint strengthens the constitution principle that Morning Operations is a distinct but connected phase of the same system heartbeat as Live Operations.

### Product moment it strengthens

The moment before the day begins when the company needs to know whether the plan is actually runnable.

Key questions:

- Are crews assigned?
- Is every critical job ready?
- Where are the gaps before dispatch?
- What requires intervention now instead of later?

### Boundaries to respect

- Do not turn Daily Plans into full scheduling logic
- Do not turn it into live status tracking for the whole day
- Do not make it the primary owner of Work Order execution state
- Do not let it absorb inventory ownership beyond readiness visibility

### Product-level success

Success means a dispatcher can prepare the day with confidence in one place, identify readiness problems early, and move into dispatch with fewer surprises.

---

## Sprint 16 — Live Operations

### Constitution mapping

- Primary domain: Live Operations
- Supporting domains referenced: Work Orders, Daily Plans, Scheduling, Inventory
- Primary user: operations manager, dispatcher, owner
- Operational moment: Dispatch + Execute

This sprint strengthens the constitution principle that Live Operations is the in-motion counterpart to Morning Operations within a single operating loop.

### Product moment it strengthens

The moment when work is in motion and leadership needs awareness without drowning in noise.

Key questions:

- What is happening right now?
- Which jobs are on track, late, blocked, or at risk?
- Where should intervention happen first?

### Boundaries to respect

- Do not turn Live Operations into a reporting suite
- Do not rebuild scheduling workflows inside a real-time view
- Do not let management visibility become a duplicate source of truth for status updates
- Do not overload the surface with historical analytics

### Product-level success

Success means the company can run the day from a shared operational view, detect issues early, and intervene quickly without losing clarity.

---

## Sprint 17 — Equipment

### Constitution mapping

- Primary domain: Assets
- Product-facing module: Equipment
- Supporting domains referenced: Work Orders, Company Brain
- Primary user: technician, installer, service manager
- Operational moment: Execute + Learn

This sprint strengthens the constitution principle that Assets are distinct from Company and that equipment context should travel with operational work.

### Product moment it strengthens

The moment when a field team or manager needs to understand the installed system behind the work order.

Key questions:

- What system is on site?
- What is its history?
- What has been serviced, replaced, or observed before?
- What context improves the current decision?

### Boundaries to respect

- Do not collapse assets into customer/company records
- Do not make Equipment the owner of operational schedule state
- Do not turn Equipment into a document vault for all knowledge
- Do not let it become inventory management by proxy

### Product-level success

Success means the installed system becomes a first-class context object, improving field confidence, service quality, and continuity over time.

---

## Sprint 18 — Inventory

### Constitution mapping

- Primary domain: Inventory
- Supporting domains referenced: Work Orders, Daily Plans, Scheduling
- Primary user: operations coordinator, warehouse lead, dispatcher
- Operational moment: Prepare + Execute

This sprint strengthens the constitution principle that readiness depends on more than assignments; material reality must also be visible.

### Product moment it strengthens

The moment when the team needs to know whether parts and materials will enable or block planned work.

Key questions:

- Do we have what this work requires?
- What is missing?
- What is at risk because stock is low or unavailable?
- Which jobs may slip because material readiness is weak?

### Boundaries to respect

- Do not expand prematurely into full procurement or accounting workflows
- Do not let Inventory own scheduling decisions
- Do not move asset history into material records
- Do not make inventory visibility the same thing as inventory optimization

### Product-level success

Success means material readiness becomes visible early enough to prevent avoidable operational failure and last-minute surprises.

---

## Sprint 19 — Scheduling

### Constitution mapping

- Primary domain: Scheduling
- Supporting domains referenced: Work Orders, Daily Plans, Live Operations, Inventory
- Primary user: dispatcher, operations coordinator
- Operational moment: Prepare + Dispatch

This sprint strengthens the constitution principle that time placement and capacity coordination are their own domain and should not be blurred into day-of planning.

### Product moment it strengthens

The moment when work must be placed intelligently across people, time, and capacity.

Key questions:

- When should this work happen?
- Who can do it?
- What capacity conflicts exist?
- How should work move when the day changes?

### Boundaries to respect

- Do not turn Scheduling into a generic calendar product
- Do not absorb Daily Plans readiness workflows into long-range planning
- Do not let real-time execution views become the owner of schedule edits
- Do not attempt full route optimization before core dispatch logic is clear

### Product-level success

Success means the company can coordinate work across calendars and crews with less friction, better capacity awareness, and cleaner handoff into Daily Plans and Live Operations.

---

## Sprint 20 — Company Brain

### Constitution mapping

- Primary domain: Company Brain
- Supporting domains referenced: Work Orders, Assets, Company, Reporting
- Primary user: owner, manager, office staff, technician
- Operational moment: Resolve + Learn

This sprint strengthens the constitution principle that Company Brain is an observing and memory layer, not the owner of core operational data.

### Product moment it strengthens

The moment when people need to recover context, preserve what was learned, and make company knowledge reusable.

Key questions:

- What do we already know about this situation?
- What should be remembered for next time?
- Where is the relevant procedure, note, or historical context?

### Boundaries to respect

- Do not make Company Brain the write path for work status, schedules, or inventory truth
- Do not let freeform notes replace structured domain records
- Do not frame Company Brain as a catch-all for unfinished architecture
- Do not confuse knowledge retrieval with autonomous decision-making

### Product-level success

Success means institutional memory becomes searchable and useful without weakening ownership in the operational domains that produce the underlying facts.

---

## Sprint 21 — Reporting

### Constitution mapping

- Primary domain: Reporting
- Supporting domains referenced: Work Orders, Scheduling, Inventory, Assets, Company
- Primary user: owner, leadership, operations manager
- Operational moment: Learn

This sprint strengthens the constitution principle that reporting should summarize the operation, not replace the operation.

### Product moment it strengthens

The moment when leadership needs to understand patterns, trends, and outcomes across time.

Key questions:

- What is improving?
- What is degrading?
- Where are bottlenecks recurring?
- How is the company performing operationally?

### Boundaries to respect

- Do not turn Reporting into the primary operational home for action
- Do not build live operational intervention workflows inside analytics surfaces
- Do not duplicate source-of-truth record editing within reports
- Do not confuse lagging metrics with real-time control

### Product-level success

Success means leadership gains trustworthy visibility into performance and trend lines while frontline operations continue to run from their primary action domains.

---

## Sprint 22 — AI

### Constitution mapping

- Primary domain: AI as a horizontal intelligence layer
- Supporting domains referenced: all major operational domains
- Primary user: every role, with role-specific assistance patterns
- Operational moment: Orient, Prepare, Execute, Resolve, Learn

This sprint strengthens the constitution principle that AI assists decisions and workflow acceleration without becoming the owner of operational truth.

### Product moment it strengthens

The moment when a user needs faster understanding, sharper prioritization, or lower-friction execution.

Key questions:

- What should I pay attention to first?
- What is likely to go wrong?
- What context matters most here?
- What next step is recommended and why?

### Boundaries to respect

- Do not allow AI to silently change source-of-truth records
- Do not make AI the only usable interface to the platform
- Do not skip explainability for important recommendations
- Do not let AI blur domain ownership or operational accountability

### Product-level success

Success means the platform becomes faster to understand and easier to operate while keeping humans in control of commitments, approvals, and state changes.

---

## Cross-sprint sequencing logic

The sprint order should be understood as operational layering:

1. Daily Plans establishes readiness
2. Live Operations establishes shared in-motion awareness
3. Equipment adds asset context to the work
4. Inventory adds material reality to planning and execution
5. Scheduling strengthens time and capacity coordination
6. Company Brain preserves reusable knowledge
7. Reporting reveals performance patterns
8. AI accelerates decisions across the full system

This sequence matters because it builds the product in the same order a company needs clarity.

---

## Guidance for future PR briefs

Every sprint PR brief should include a short constitution alignment section with:

- **Primary domain**
- **Primary user**
- **Operational moment**
- **Source-of-truth owner**
- **Boundaries / not in scope**
- **Product-level success statement**

If a future brief cannot answer those six points clearly, the scope should be narrowed before implementation begins.

---

## Naming guidance for roadmap planning

- Use **Operations Home** instead of generic dashboard language when describing the orientation layer
- Use **Work Orders** for the operational execution object referenced by surrounding domains
- Use **Equipment** for the user-facing module and **Assets** for the broader domain model
- Use **Company Brain** only for knowledge and memory workflows, never for operational ownership
- Use **Morning Operations** and **Live Operations** as product moments, not as isolated silos

---

## Final standard

The roadmap is aligned when each sprint makes LOOP feel more like a working operating system for contractors and less like a collection of software features.
