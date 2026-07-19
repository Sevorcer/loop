# Readiness Fix Pack 2 Summary (Deferred P1 completion + P2 hardening)

## Overview

Fix Pack 2 completes the deferred P1 items from Fix Pack 1 and closes a set of
high-impact P2 gaps across frequently used operator paths. All changes are
production-hardening in nature — no new features, no architecture rewrites.

---

## Fixed in This PR

### 1. Dispatch Crew Assignment Controls (P0 deferred from Fix Pack 1)
**Phase references:** Phase 2 workflow matrix (P0 #2), Phase 1 product audit (Dispatch domain), Fix Pack 1 Deferred #1

**What changed:**
- `DispatchProvider` upgraded from a pure read-only snapshot (useMemo only) to
  mutable state backed by `localStorage` — identical pattern to
  `PropertiesProvider` / `DailyPlansProvider`.
- Added `assignCrew(planId, crewId)` mutation: creates a new `CrewAssignment`
  record (or updates the reassignment history of an existing one) and appends a
  `crew_assigned` dispatch event to the event log.
- `DispatchBoardCard` now renders an inline crew picker (`<select>`) for plans
  in `ready_to_schedule` or `awaiting_crew_availability` status, visible only
  when `availableCrews` and `onAssignCrew` are wired.
- `DispatchScreen > DispatchBoard` wires the picker: available crews (those with
  `availability === "available" | "partially_available"`) are offered; the new
  assignment is immediately reflected in the board and event log.

**Evidence of deferred item closure:**
> "Dispatch P0 completion: add crew assignment and schedule mutation controls
> directly in `/dispatch`" — Fix Pack 1 suggested next-pack scope.

---

### 2. Vehicle Alert Lifecycle Controls (P1 → acknowledge / schedule / resolve)
**Phase references:** Phase 1 (Vehicle Alerts domain), Phase 2 interaction matrix, Fix Pack 1 Risks (#2)

**What changed:**
- `VehicleAlertColumns.tsx` replaced `vehicleAlertColumns` static export with
  `buildVehicleAlertColumns(onUpdateStatus)` factory that injects an `actions`
  column at the end of each row.
- Status progression is one-directional: New → Acknowledged → Scheduled →
  Resolved. The action label reflects the next target state. Resolved rows show
  "Closed" (read-only).
- `VehicleAlertTable` accepts `onUpdateStatus?: (id, status) => void` prop and
  builds columns via the factory.
- `VehicleAlertsScreen` implements `handleUpdateStatus` and wires it through.
- The static `vehicleAlertColumns` export is preserved for backward compatibility
  (used as a no-op fallback).

**Evidence of deferred item closure:**
> "Vehicle alert lifecycle controls: add acknowledge/schedule/resolve actions"
> — Fix Pack 1 suggested next-pack scope.

---

### 3. New Customer Creation Flow (P2 — dead-end CTA)
**Phase references:** Phase 1 (Customers domain), Phase 2 P1 failures #1, Phase 3 top-5 priority action #1

**What changed:**
- Created `CustomersProvider` (`src/features/customers/state/CustomersProvider.tsx`):
  localStorage-backed mutable customer list, identical pattern to
  `PropertiesProvider`. Exposes `createCustomer()` and `getCustomerById()`.
- Created `NewCustomerForm` (`src/features/customers/components/NewCustomerForm.tsx`):
  full-page form with validation, success state, and "Create Another" path.
- Created `/customers/new` route (`src/app/(shell)/customers/new/page.tsx`).
- Created `src/app/(shell)/customers/layout.tsx` wrapping all customer routes
  in `CustomersProvider`.
- `CustomersScreen` "New Customer" button now navigates to `/customers/new`
  instead of being a no-op.
- `CustomerTable` now reads from `CustomersProvider` (live state) instead of
  `mockCustomers` — newly created customers appear immediately in the directory.
- `CustomerDetailClient` (client component) resolves customer by ID from the
  provider, so newly created customers are immediately navigable.

---

### 4. Daily Plans — Packet Dispatch Tracking (P1 deferred from Fix Pack 1)
**Phase references:** Phase 1 (Daily Plans domain), Phase 2 P1 failures #3, Fix Pack 1 Deferred #2

**What changed:**
- Added `packetsSent: Record<string, boolean>` state to `DailyPlansProvider`,
  backed by localStorage key `loop.daily-plans.packets`.
- Added `getPacketsSent(date): boolean` and `markPacketsSent(date): void` to
  the `DailyPlanStoreValue` interface and provider implementation.
- `DailyPlansScreen` now calls `markPacketsSent(selectedDate)` when the user
  sends packets, replacing the ephemeral notice-only behaviour.
- `MorningOperationsHero` accepts `packetsAlreadySent?: boolean`. When true,
  the "Send packets" button is replaced by a persistent "✓ Packets sent"
  indicator, making the action one-time and traceable per day.
- Button label renamed from "Print packets" to "Send packets" for clarity.

---

## Deferred Again

### 1. Cross-route shared persistence and truth alignment (P1)
**Reason:** Dashboard, Customers, and Properties still diverge from live job
state after job mutations. Resolving this correctly requires establishing a
shared operational event stream (see ADR-0001) rather than patching individual
divergences. This remains the recommended first item for Fix Pack 3.

### 2. Dispatch `schedulePlan()` mutation — target date / Schedule Block creation (partial P0)
**Reason:** Crew assignment is now wired. Setting the execution date and
generating a `ScheduleBlock` requires UX decisions around the calendar
interaction model (inline date picker vs. schedule modal). Deferred to
Fix Pack 3 with the crew assignment foundation now in place.

### 3. Customer detail route for newly-created customers — tab content
**Reason:** `CustomerDetailScreen` still resolves tab content from
`mockCustomerDetails`. Newly created customers show empty tabs. Fixing this
cleanly requires a `CustomerDetailsProvider` (or extending
`CustomersProvider`). Deferred to Fix Pack 3.

### 4. Property detail continuity (from Fix Pack 1)
**Reason:** `/properties/[id]` still resolves from `mockProperties` in the
page component (same pattern as `/customers/[id]` before this PR). The
`PropertiesProvider`/`PropertyDetailClient` pattern demonstrated here for
customers should be applied to properties in Fix Pack 3.

---

## Risks / Known Limitations

- Crew assignments and packet-sent flags persist in `localStorage` for the
  session/browser. A hard browser-storage clear will reset them to mock
  defaults. This is acceptable for the current preview tier.
- Vehicle alert status changes are in-memory only (no localStorage). A page
  refresh resets alerts to mock data. The same persistence pattern applied to
  customers and dispatch should be applied to vehicle alerts in Fix Pack 3.
- Dispatch `assignCrew` updates the `assignments` array but does not mutate
  `DispatchPlan.dispatchStatus` from `awaiting_crew_availability` →
  `scheduled`. The metrics card will not yet reflect the assignment. Requires
  the `schedulePlan` mutation (deferred above).

---

## Recommended Scope for Fix Pack 3

1. **Dispatch `schedulePlan` mutation** — date picker, ScheduleBlock creation,
   and `dispatchStatus` transition to `scheduled`.
2. **Cross-route data truth** — derive Dashboard/Customers/Properties counts
   from shared operational state (Jobs provider).
3. **Property detail continuity** — apply the `PropertyDetailClient` pattern
   (same as `CustomerDetailClient` introduced here).
4. **Vehicle alert localStorage persistence** — apply provider/localStorage
   pattern so alert status changes survive navigation.
5. **Customer detail tab content for new customers** — extend provider to carry
   `CustomerDetails` stubs for provider-created records.
