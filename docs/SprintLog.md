\# LOOP Sprint Log



\## Sprint 24 — P0: RLS Baseline + Role Matrix Enforcement

Status: Complete

\### Completed

\- Defined approved internal role set: Owner, Manager, Dispatch, Tech, Office, Sales, Portal
\- Created `database/migrations/001_core_schema.sql` — core operational tables (organizations, user_profiles, customers, properties, contractors, jobs, job_activity, portal_users, portal_memberships)
\- Created `database/policies/001_rls_baseline.sql` — deny-by-default RLS baseline for all core tables
\- Created `database/policies/002_role_policies.sql` — explicit allow policies per role for all core tables
\- Created `docs/architecture/security/rls-role-matrix.md` — permission matrix doc (single source of truth)
\- Created `src/services/authorization.ts` — TypeScript authorization contract mirroring the matrix
\- Created `src/services/__tests__/authorization.test.ts` — 58 automated role-matrix tests (allowed, denied, privilege escalation)
\- Updated `database/README.md` with apply order, security posture, and extension guide

\### Outcome

Deny-by-default RLS baseline is established for all core operational tables. Every role is tested against allowed and denied operations. Portal users are structurally isolated from internal operational tables. No unauthorized access path exists in the policy matrix; all escalation scenarios are covered by automated tests.

---



\## Sprint 11 - Properties List

Status: Complete



\### Completed

\- property list page structure

\- property toolbar

\- property table

\- property columns

\- property type model

\- mock properties dataset

\- search

\- filters

\- pagination

\- sorting support

\- empty state

\- loading state

\- app shell integration for properties route

\- sidebar active-state polish for nested property routes



\### Outcome

The properties list experience is now integrated into the main application shell and supports core operational browsing behavior.



\---



\## Sprint 12 - Property Details

Status: In Progress



\### Completed So Far

\- property detail route wired to `/properties/\[id]`

\- property detail screen integrated into app shell

\- header summary for property

\- map section retained

\- tabbed detail navigation added

\- overview tab

\- equipment tab

\- jobs tab

\- timeline tab

\- contacts tab

\- warranty tab

\- notes tab

\- documents tab with real mock-backed card rendering

\- photos tab with real mock-backed card rendering

\- detail data contract extracted from UI component

\- mock property detail dataset created



\### Current State

Sprint 12 now has a stable screen architecture and mock data contract for the full property detail experience.



\### Next Candidates

\- mobile detail navigation polish review

\- extract reusable ATLAS detail primitives

\- add deeper empty states and action patterns

\- improve relation between property jobs and future jobs feature

\- prepare property detail services layer for backend integration



\---



\## Upcoming Sprints

\- Customers

\- Jobs

\- Daily Plans

\- Live Operations

\- Equipment

\- Inventory

\- Scheduling

\- Company Brain

\- Reporting

\- AI

