# Product Audit

## Shared App Shell / navigation structure

**Status:** Partial

### Strengths

- The shared shell creates a consistent operating environment across the product.
- Sidebar grouping is understandable at a glance: Overview, Operations, Field, Resources, Insights, Workspace.
- The mobile drawer and sticky header give the app a coherent responsive frame.

### Weaknesses

- Breadcrumbs flatten most nested flows to `Dashboard / Current Page`, which is too shallow for detail pages.
- The shell surfaces routes that are not equally mature, but it does not signal that difference.
- Several pages repeat a large hero pattern before the user reaches actionable content.

### Overlap / boundary concerns

- The shell should orient the user, not force them to interpret domain boundaries on its own.
- Daily Plans, Live Operations, and Dispatch all appear as peers in navigation even though they represent different moments in the same operating loop.

### Findings

- **P1** — Live Operations is always reachable from the sidebar even when the day has not started, creating a valid route that still behaves like a dead-end state.
- **P2** — Nested pages need deeper breadcrumbs such as `Dashboard / Jobs / Job Details` instead of `Dashboard / Job Details`.
- **P2** — The repeated header-plus-hero pattern pushes useful work content below the fold on smaller screens.
- **P3** — Customers and Vehicle Alerts appear in the sidebar but are not centralized alongside the other route constants, which increases navigation maintenance drift.

---

## Dashboard

**Status:** Partial

### Strengths

- The page has one clear responsibility: summarize what needs attention right now.
- Module ordering is strong: attention first, metrics second, activity and actions after.
- It feels calmer than the more narrative domain pages.

### Weaknesses

- Quick Actions look like primary launch tiles but do not complete real flows.
- The content is static and summary-oriented, with limited evidence of drilldown behavior.
- Recent Activity informs, but does not clearly route the user into next actions.

### Overlap / boundary concerns

- Dashboard should display operational truth from other domains, not become a second control panel for them.

### Findings

- **P1** — Quick Actions create expectation of one-click workflow entry, but they currently behave like decorative controls rather than dependable launch points.
- **P2** — Recent Activity should deep-link into the underlying job, property, or workflow event to turn awareness into action.

---

## Jobs

**Status:** Partial

### Strengths

- Jobs is the clearest execution workspace in the product.
- The domain includes list, create, detail, and edit routes, which gives it the strongest shape of an end-to-end workflow.
- The detail page ties status, notes, timeline, and installed systems together in one place.

### Weaknesses

- The top-level screen still spends meaningful vertical space on branding and framing before the board itself.
- The page reads as an operational hub, but its flows still depend on in-app state rather than durable product truth.
- The hierarchy emphasizes the hero card almost as much as the board.

### Overlap / boundary concerns

- Jobs should own execution progress and job-specific notes.
- It should display installed-system truth and readiness signals, but not own those truths itself.

### Findings

- **P1** — Jobs is the closest domain to production shape, but it still behaves like a local demo workflow rather than a fully trustworthy execution system.
- **P2** — The first viewport should bias even harder toward the board and active work state, especially on mobile.

---

## Properties

**Status:** Partial

### Strengths

- The route has a clear domain purpose: property portfolio and site context.
- The property detail page is strong at helping a field user understand where they are going and what they should know before arrival.
- The map, arrival, job-story, and system context are useful operational framing.

### Weaknesses

- The top-level `New Property` action is visually primary but does not lead to a creation flow.
- The list page is directory-first, but not obviously tied to the strongest property tasks.
- Some property intelligence is static and not clearly connected to deeper system or customer truth.

### Overlap / boundary concerns

- Properties should own site context and arrival context.
- Customer ownership should stay in Customers, and technical truth should stay in Installed Systems.

### Findings

- **P1** — `New Property` is a dead-end primary action on a top-level field domain.
- **P2** — Property detail currently mixes site truth with lightly connected “home intelligence,” which risks becoming duplicated knowledge once Company Brain and Installed Systems mature further.

---

## Daily Plans

**Status:** Partial

### Strengths

- Daily Plans has a distinct responsibility and a strong operational point of view.
- The page answers a real morning question: are crews and jobs ready to start the day?
- Activation, readiness, crew grouping, and notes create a believable operating rhythm.

### Weaknesses

- Some key actions still resolve to lightweight in-page notices rather than dependable workflows.
- The route is information-rich, but the amount of content can become dense before users reach the exact crew or issue they need.
- The route assumes familiarity with upstream job data and downstream live operations behavior.

### Overlap / boundary concerns

- Daily Plans should own the morning launch moment.
- It should show dispatch and inventory readiness, not redefine them.

### Findings

- **P1** — Placeholder-style actions such as packet printing reduce trust in a page that otherwise behaves like a real operating surface.
- **P2** — The page would benefit from stronger visual compression around crew cards and secondary notes on mobile.
- **P2** — Daily Plans, Dispatch, and Live Operations need more explicit handoff language so users know when to leave one workspace for the next.

---

## Live Operations

**Status:** Partial

### Strengths

- The route has a sharp purpose once active: monitor active crews and live-day changes.
- The guard state correctly protects against showing fake active-day data before the day starts.
- The page structure focuses on monitoring, exceptions, and timeline visibility.

### Weaknesses

- The route is top-level navigation even when it is unavailable for meaningful use.
- The inactive-state guard is clean, but still a frustrating stop if a user expected work to happen there.
- It is not obvious from navigation alone that the page depends on Daily Plans activation.

### Overlap / boundary concerns

- Live Operations should own active-day monitoring.
- It should display dispatch, readiness, and field events, not become a substitute for planning or scheduling.

### Findings

- **P1** — A top-level route that often resolves to a guard state needs stronger affordance before the click, not only after it.
- **P2** — The transition from Daily Plans to Live Operations should feel more explicit and system-guided.

---

## Dispatch

**Status:** Partial

### Strengths

- The page has a strong conceptual model and explains the domain clearly.
- Board grouping is easy to understand: In Progress, Ready to Schedule, Scheduled, Waiting.
- The route communicates dispatchability as a cross-domain readiness problem instead of a calendar-only problem.

### Weaknesses

- The page spends a lot of prime screen real estate teaching the model before letting the dispatcher act on it.
- The route looks like a scheduling workspace but behaves primarily as a read-only board.
- Crew schedule and dispatch board are visible, but not obviously editable from the page.

### Overlap / boundary concerns

- Dispatch should own scheduling truth.
- It should consume readiness from Inventory and technical truth from Installed Systems, not copy them.

### Findings

- **P1** — Dispatch feels important but under-operable; the page promises action more than it currently delivers it.
- **P2** — The “aggregate root” and “formula” explanation is useful context, but it competes with the live board for first-viewport attention.

---

## Inventory

**Status:** Partial

### Strengths

- The route has a clear operational question: can this work actually happen?
- Warehouse, material plans, and status summaries support that question well.
- The page frames inventory as allocation and readiness, not just stock counts.

### Weaknesses

- The page is rich in status but light in action.
- The warehouse view looks workflow-adjacent, but there is no obvious pick, reserve, or escalate action from the main screen.
- The hero plus architecture note delays the first actionable list.

### Overlap / boundary concerns

- Inventory should own material truth.
- Dispatch and Jobs should display that truth without duplicating inventory decision-making.

### Findings

- **P1** — Inventory communicates readiness well but does not yet behave like a dependable operator workspace.
- **P2** — The strongest task list on the page is the warehouse view, so it should move higher in the visual hierarchy.

---

## Installed Systems

**Status:** Partial

### Strengths

- The domain owns a clear business truth: persistent technical identity.
- The detail page is one of the strongest examples of boundary-aware design in the app.
- Catalog, permit inheritance, known truth, discovered truth, and operational history are well separated.

### Weaknesses

- The top-level list route is informative, but not obviously task-driven.
- The route lacks clear create/confirm/reconcile flows from the list level.
- The hero and architecture framing again compete with the actual list.

### Overlap / boundary concerns

- Installed Systems should own technical truth.
- Properties, Jobs, and permits should consume that truth instead of restating it.

### Findings

- **P1** — The list view needs a clearer operational action model for unresolved or low-confidence system matches.
- **P2** — Technical identity is well explained, but the route needs a faster path from “needs confirmation” to resolution work.

---

## Company Brain

**Status:** Partial

### Strengths

- The domain has a strong purpose and a coherent search-first interaction model.
- Search, type filters, and detail drill-in create a believable knowledge workspace.
- The page makes a compelling case for operational knowledge as a real asset.

### Weaknesses

- The screen is long and visually dense before the user settles into a single answer.
- The page is excellent at browsing and reading, but not at authoring, improving, or resolving knowledge gaps.
- The search interaction is useful, but not yet clearly connected to surrounding workflows.

### Overlap / boundary concerns

- Company Brain should own reusable organizational knowledge.
- Domain-specific pages should display relevant knowledge, not copy it into local “tips” or static intelligence lists.

### Findings

- **P1** — Company Brain is persuasive as a concept, but not yet complete as an operational knowledge loop because creation and improvement workflows are not surfaced alongside search.
- **P2** — The long-form page narrative should give way more quickly to the search result area, especially on smaller devices.

---

## Reporting

**Status:** Partial

### Strengths

- Reporting keeps a clear boundary: it interprets operational truth instead of owning it.
- The company health banner and scorecard structure are easy to understand.
- The route already feels calmer and more analytical than the execution domains.

### Weaknesses

- It is a strong readout page, but it lacks obvious time filters, drilldowns, or comparative controls.
- The user can read status, but cannot easily answer “why did this change?” from the page itself.
- The reporting surface is less interactive than its importance suggests.

### Overlap / boundary concerns

- Reporting should remain derived and cross-domain.
- It should expose paths back to source domains when a scorecard needs intervention.

### Findings

- **P1** — Reporting needs drilldown paths into source operations to support real management action.
- **P2** — Time-range and comparison controls are missing from a route positioned as performance intelligence.

---

## Customers

**Status:** Partial

### Strengths

- The route has a clear responsibility and fits naturally beside Properties and Jobs.
- Directory and detail coverage gives the domain believable shape.
- Customer context complements the property and job model well.

### Weaknesses

- `New Customer` is a dead-end primary action.
- The route exists in the product shell, but feels less integrated into the route-constant pattern than peer domains.
- The page currently reads more as a clean directory than a fully operational customer workspace.

### Overlap / boundary concerns

- Customers should own account relationships and contact truth.
- Properties should display customer context without absorbing ownership of it.

### Findings

- **P1** — `New Customer` is another top-level primary CTA that is not yet backed by a real workflow.
- **P2** — Customer-to-property and customer-to-job relationships should become more obviously navigable from first viewport content.

---

## Vehicle Alerts

**Status:** Partial

### Strengths

- The route answers a specific operational need and gives fleet issues a distinct home.
- The page is easy to scan and aligned with the rest of the shell.
- It is appropriately narrow in scope.

### Weaknesses

- `Report Alert` is a dead-end primary action.
- The route appears list-driven, with limited evidence of a full acknowledgement or escalation workflow.
- It risks feeling secondary because it lacks the same operational depth as the main field domains.

### Overlap / boundary concerns

- Vehicle Alerts should own fleet issue intake and follow-up.
- It should not become a generic exception queue for unrelated operational blockers.

### Findings

- **P1** — `Report Alert` needs a real intake flow before the route can be treated as dependable.
- **P2** — Alert acknowledgement, ownership, and resolution state should be more explicit from the main page.

---

## Settings

**Status:** Placeholder

### Strengths

- The route exists, so the workspace has a reserved place for future configuration.

### Weaknesses

- The page currently communicates intent only.
- There is no settings information architecture, sectioning, or usable configuration.
- As a sidebar destination, it creates an expectation the current page cannot satisfy.

### Overlap / boundary concerns

- None yet; the route has not matured enough to express boundaries.

### Findings

- **P1** — Settings is not ready to be treated as a real workspace destination.
- **P3** — Once implemented, Settings should be split into purposeful sections instead of becoming a generic catch-all page.
