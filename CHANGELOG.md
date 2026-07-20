# Changelog

All notable changes to LOOP are documented here.

---

## [Unreleased]

### Sprint 25 — API Authorization Layer

#### Backend enforcement
- Added `src/lib/api-auth.ts` — centralized API authorization middleware.
  - `resolveRequestRole(request)` extracts the caller's `AppRole` from the `X-Loop-Role` header (development/test). Designed for a drop-in Supabase JWT replacement when real auth lands.
  - `requirePermission(request, table, action)` returns a discriminated union `{ ok: true, ctx }` / `{ ok: false, response }`. All route handlers call this before any business logic.
  - `unauthorizedResponse()` — standardized 401 JSON envelope `{ error: "UNAUTHORIZED", message, code: 401 }`.
  - `forbiddenResponse()` — standardized 403 JSON envelope `{ error: "FORBIDDEN", message, code: 403 }`.
  - Deny-by-default: no identity → 401; authenticated but wrong role → 403; unmapped action → 403.
- Added `src/lib/audit.ts` — structured audit event helper (`emitAuditEvent`). All mutation routes (POST/PATCH/DELETE) emit a `[AUDIT]` JSON log line before returning a success response. Designed for a drop-in Supabase `job_activity` insert.
- Added API routes with explicit authorization gates for all in-scope resources:
  - `src/app/api/customers/route.ts` — GET (select), POST (insert)
  - `src/app/api/customers/[id]/route.ts` — GET (select), PATCH (update), DELETE (delete)
  - `src/app/api/properties/route.ts` — GET (select), POST (insert)
  - `src/app/api/properties/[id]/route.ts` — GET (select), PATCH (update), DELETE (delete)
  - `src/app/api/jobs/route.ts` — GET (select), POST (insert)
  - `src/app/api/jobs/[id]/route.ts` — GET (select), PATCH (update), DELETE (delete)
  - `src/app/api/dispatch/route.ts` — GET (jobs/select)
  - `src/app/api/documents/route.ts` — GET (portal_memberships/select), POST (portal_memberships/insert)

#### Frontend permission UX
- Added `src/features/auth/` — role context and UI permission primitives.
  - `RoleProvider` / `useCurrentRole` — client-side role context backed by `localStorage` (`loop_dev_role`, default `owner`). Starts as `null` during SSR to prevent flash of unauthorized content.
  - `usePermission(table, action)` — hook returning `boolean | null` (null during loading).
  - `PermissionGate` — renders children only when the current role has permission; renders nothing during loading to prevent unauthorized flash; accepts optional `fallback` prop.
- Wired `RoleProvider` into `src/app/(shell)/layout.tsx` so every feature screen has role context.
- Gated restricted UI elements with `PermissionGate`:
  - New Job button (`/jobs`) — `jobs/insert` — hidden for `dispatch`, `tech`, `sales`, `portal`
  - Edit Job link and status actions panel (`/jobs/[id]`) — `jobs/update` — hidden for `office`, `sales`, `portal`
  - New Customer button (`/customers`) — `customers/insert` — hidden for `dispatch`, `tech`, `portal`
  - New Property button (`/properties`) — `properties/insert` — hidden for `dispatch`, `tech`, `portal`

#### Tests
- Added `src/lib/__tests__/api-auth.test.ts` — 35 tests covering:
  - `resolveRequestRole`: valid/invalid/missing header cases
  - `requirePermission`: 401 unauthenticated, 403 denied, allow paths for all 7 roles
  - Full deny-by-default matrix: unauthenticated denied on all tables/actions
  - Portal isolation: all internal tables denied for `portal` role (full matrix)
  - Append-only `job_activity` invariant: no role may update or delete
  - Error envelope format consistency

#### Documentation
- Updated `docs/architecture/security/rls-role-matrix.md` — added Sprint 25 API Authorization Layer section: endpoint→table/action mapping, error response format, role resolution design, audit event format, and frontend gate inventory.

---

### Sprint 24 — CI Migration Pipeline

- Added `supabase/migrations/` directory with `20240101000000_initial_schema.sql` baseline migration.
- Added `scripts/verify-migrations.sh` — offline validation script that checks migration file naming conventions, duplicate timestamps, ordering, and empty files.
- Added `.github/workflows/db-migrations.yml` — CI workflow that runs on PRs and pushes to `main` touching migration or Supabase config files.
  - `verify-structure` job: validates migration file sequence without database credentials.
  - `apply-and-verify` job: applies pending migrations via `supabase db push` and detects schema drift via `supabase db diff`.
- Added `docs/migration-runbook.md` — local developer runbook covering setup, daily workflow, rollback procedures, and CI failure resolution.

---
