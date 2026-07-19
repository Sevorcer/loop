# Readiness Fix Pack 3 Summary (Deferred P2 completion + cross-domain consistency hardening)

## Overview

Fix Pack 3 completes the deferred P2 items from Fix Pack 2 and closes three
high-impact consistency gaps across the most frequently used operator paths:
Property detail navigation, Dispatch scheduling completion, and Vehicle Alert
state persistence. All changes are production-hardening — no new features, no
architecture rewrites.

---

## Fixed in This PR

### 1. Property Detail Continuity (P2 deferred from Fix Pack 1 and Fix Pack 2)
**Phase references:** Fix Pack 1 Deferred #4, Fix Pack 2 Deferred #4

**What changed:**
- Created `PropertyDetailClient` (`src/app/(shell)/properties/[id]/PropertyDetailClient.tsx`):
  a client component that resolves property by ID from `PropertiesProvider`
  (the same provider wrapping all `/properties/` routes via `layout.tsx`).
- Updated `/properties/[id]/page.tsx` to delegate to `PropertyDetailClient`
  instead of resolving directly from `mockProperties`.
- Newly created properties (via `/properties/new`) are now immediately
  navigable from the Properties directory — no stale mock-data 404.

**Pattern consistency:** matches the `CustomerDetailClient` pattern introduced
in Fix Pack 2, applying it uniformly to the Properties domain.

**Evidence of deferred item closure:**
> "Property detail continuity — apply the PropertyDetailClient pattern (same
> as CustomerDetailClient introduced here)." — Fix Pack 2 Deferred #4.

---

### 2. Dispatch `schedulePlan` Mutation (P0/P2 deferred from Fix Pack 2)
**Phase references:** Phase 2 P0 #2, Fix Pack 2 Deferred #2, Fix Pack 2 Risks (#3)

**What changed:**
- Added `extraScheduleBlocks` state to `DispatchProvider` backed by
  `localStorage` key `loop.dispatch.scheduleBlocks`.
- Added `planStatusOverrides` state (Record<string, DispatchStatus>) backed by
  `localStorage` key `loop.dispatch.planStatusOverrides`. This allows the
  provider to promote plan status to `scheduled` without mutating the immutable
  `mockDispatchPlans` records.
- `resolvedPlans` memo merges status overrides into plans before snapshot
  assembly, so metrics cards (Ready / Scheduled / In Progress) reflect the
  current mutable state correctly.
- Added `schedulePlan(planId, date)` mutation: creates a `ScheduleBlock` with
  a default 07:00 start time derived from `estimatedDurationHours`, transitions
  the plan's `dispatchStatus` to `scheduled`, and appends a `job_scheduled`
  dispatch event to the event log.
- `DispatchBoardCard` now accepts `onSchedulePlan?: (planId, date) => void`
  prop and renders a date-picker control for plans in `ready_to_schedule` status
  that already have a crew assigned.
- `DispatchScreen > DispatchBoard` wires `schedulePlan` through to each card.

**Evidence of deferred item closure:**
> "Dispatch schedulePlan mutation — date picker, ScheduleBlock creation, and
> dispatchStatus transition to scheduled." — Fix Pack 2 Deferred #2.

**Dispatch metrics now reflect assignments:**
> "Dispatch assignCrew updates the assignments array but does not mutate
> DispatchPlan.dispatchStatus from awaiting_crew_availability → scheduled.
> The metrics card will not yet reflect the assignment." — Fix Pack 2 Risks (#3).
>
> This is resolved: after `schedulePlan`, the plan status transitions to
> `scheduled` and the metrics card immediately reflects the change.

---

### 3. Vehicle Alert localStorage Persistence (P2 deferred from Fix Pack 2)
**Phase references:** Fix Pack 2 Risks (#2), Phase 1 (Vehicle Alerts domain)

**What changed:**
- Created `VehicleAlertsProvider` (`src/features/vehicle-alerts/state/VehicleAlertsProvider.tsx`):
  localStorage-backed mutable alert list, identical pattern to
  `CustomersProvider` / `PropertiesProvider`. Exposes `createAlert()` and
  `updateAlertStatus()`.
- Created `/vehicle-alerts/layout.tsx` wrapping the vehicle-alerts route in
  `VehicleAlertsProvider`.
- `VehicleAlertsScreen` now reads alerts and mutations from the provider via
  `useVehicleAlerts()` instead of managing local `useState`.
- Alert status changes (New → Acknowledged → Scheduled → Resolved) now persist
  across page navigation and browser refreshes.
- New alerts reported via the Report Alert form are now persisted to
  localStorage and survive navigation.

**Evidence of deferred item closure:**
> "Vehicle alert localStorage persistence — apply provider/localStorage
> pattern so alert status changes survive navigation." — Fix Pack 2 Deferred #4.

---

## Regression Hardening Preserved

- `PropertyDetailClient` follows the exact `CustomerDetailClient` pattern
  established in Fix Pack 2. Same notFound() guard, same provider lookup,
  same page-level delegation pattern.
- `DispatchProvider` localStorage keys are additive — existing
  `loop.dispatch.assignments` and `loop.dispatch.events` keys are untouched.
  New keys (`loop.dispatch.scheduleBlocks`, `loop.dispatch.planStatusOverrides`)
  only write new state.
- `VehicleAlertsProvider` initialises from `mockVehicleAlerts` as fallback,
  so the screen is never empty on first load.
- Build verified: TypeScript passes, all 20 routes compile and generate
  cleanly (○ static / ƒ dynamic as before this PR).

---

## Deferred Again

### 1. Cross-route shared persistence and truth alignment (P1)
**Reason:** Dashboard, Customers, and Properties still diverge from live job
state after job mutations. Resolving this correctly requires establishing a
shared operational event stream (ADR-0001) rather than patching individual
divergences. Remains the highest-impact architectural item for Fix Pack 4.

### 2. Customer detail tab content for new customers
**Reason:** `CustomerDetailTabs` already returns a graceful empty stub for
provider-created customers (fallback path in `getCustomerDetails`). The tabs
show no content because no details record exists — this is acceptable for the
current tier. Full tab content for new customers requires a
`CustomerDetailsProvider` or a merge into `CustomersProvider`. Deferred to
Fix Pack 4.

### 3. Daily Plans — Crew start-day and call-customer operations (P1)
**Reason:** These placeholder actions need downstream operational models (crew
start events, communication logs) before they can be made durable. Deferred
pending operational model definition.

### 4. Dispatch — Crew dispatch ("Dispatch Crew" button / dispatched status)
**Reason:** After scheduling, the workflow continues: crews need a "Dispatch"
CTA that transitions assignment status to `dispatched` and plan status to
`in_progress`. The scheduling foundation now in place makes this the natural
next step in the Dispatch mutation chain.

---

## Risks / Known Limitations

- Dispatch ScheduleBlocks created via `schedulePlan` use a fixed 07:00 start
  time. A time picker is not yet included; it can be added in Fix Pack 4
  without breaking the data model.
- All persistence remains `localStorage`-bound (single browser session). A
  hard localStorage clear resets to mock defaults. This is acceptable for the
  current preview tier.
- Vehicle alert status progression remains client-enforced (one-directional:
  New → Acknowledged → Scheduled → Resolved). No server-side validation exists.

---

## Recommended Scope for Fix Pack 4

1. **Dispatch "Dispatch Crew" action** — transition assignment status to
   `dispatched` and plan status to `in_progress` after scheduling. Completes
   the full dispatch workflow chain.
2. **Cross-route data truth** — derive Dashboard and Customers counts from
   shared Jobs provider state (ADR-0001 implementation start).
3. **Customer detail tab content** — extend `CustomersProvider` to carry
   `CustomerDetails` stubs for provider-created records.
4. **Daily Plans — Crew start-day and call-customer events** — replace
   placeholder actions with persisted crew start and communication-log events.
5. **Dispatch schedule time picker** — add a time input alongside the date
   picker in `DispatchBoardCard` for more precise scheduling control.
