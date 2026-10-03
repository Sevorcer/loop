# Endpoint Authorization Inventory — LOOP API
**Version:** 2.0
**Sprint:** 32
**Status:** Approved
**Last updated:** 2026-10-03

This document is the committed, source-of-truth inventory of every LOOP API endpoint and its authorization mapping.

The automated test at `src/lib/__tests__/api-route-authz-coverage.test.ts` enforces that every `route.ts` file under `src/app/api/` either calls an approved authorization primitive or is explicitly listed in the `EXEMPT_ROUTES` registry inside that test. **CI fails if a new protected route is introduced without a mapping.**

For the underlying role × table × action permission matrix, see [`rls-role-matrix.md`](./rls-role-matrix.md).

---

## Authorization Primitives

| Primitive | Location | Purpose |
|-----------|----------|---------|
| `requirePermission(request, table, action)` | `src/lib/api-auth.ts` | Role-based gate for all data-layer CRUD routes. Returns `{ ok: true, ctx }` or `{ ok: false, response }`. |
| `requireApiSession()` | `src/lib/auth/apiGuard.ts` | Session-only gate for routes that verify identity without a table/action scope (e.g. search, sign-out). |
| Bearer token (`LOOP_HEALTH_CHECK_TOKEN`) | Route-local | CI automation endpoints exempt from session auth. |

---

## Endpoint Inventory

### Standard error envelope

All authorization failures return a consistent JSON envelope regardless of which primitive is used:

```json
// 401 — unauthenticated
{ "error": "UNAUTHORIZED", "message": "...", "code": 401, "reason": "missing_token" }

// 403 — authenticated, insufficient role
{ "error": "FORBIDDEN", "message": "Role 'X' is not permitted to perform 'Y' on 'Z'.", "code": 403, "reason": "insufficient_permission" }
```

### Endpoint × Method → Authorization mapping

| Route file | Method | Auth primitive | Table | Action |
|-----------|--------|---------------|-------|--------|
| `customers/route.ts` | GET | `requirePermission` | `customers` | `select` |
| `customers/route.ts` | POST | `requirePermission` | `customers` | `insert` |
| `customers/[id]/route.ts` | GET | `requirePermission` | `customers` | `select` |
| `customers/[id]/route.ts` | PATCH | `requirePermission` | `customers` | `update` |
| `customers/[id]/route.ts` | DELETE | `requirePermission` | `customers` | `delete` |
| `customers/[id]/properties/route.ts` | GET | `requirePermission` | `customers` | `select` |
| `customers/[id]/jobs/route.ts` | GET | `requirePermission` | `jobs` | `select` |
| `properties/route.ts` | GET | `requirePermission` | `properties` | `select` |
| `properties/route.ts` | POST | `requirePermission` | `properties` | `insert` |
| `properties/[id]/route.ts` | GET | `requirePermission` | `properties` | `select` |
| `properties/[id]/route.ts` | PATCH | `requirePermission` | `properties` | `update` |
| `properties/[id]/route.ts` | DELETE | `requirePermission` | `properties` | `delete` |
| `properties/[id]/jobs/route.ts` | GET | `requirePermission` | `jobs` | `select` |
| `properties/[id]/artifacts/route.ts` | GET | `requirePermission` | `properties` | `select` |
| `contractors/route.ts` | GET/POST | `requirePermission` | `contractors` | `select`/`insert` |
| `crews/route.ts` | GET/POST | `requirePermission` | `contractors` | `select`/`insert` |
| `jobs/route.ts` | GET | `requirePermission` | `jobs` | `select` |
| `jobs/route.ts` | POST | `requirePermission` | `jobs` | `insert` |
| `jobs/[id]/route.ts` | GET | `requirePermission` | `jobs` | `select` |
| `jobs/[id]/route.ts` | PATCH | `requirePermission` | `jobs` | `update` |
| `jobs/[id]/route.ts` | DELETE | `requirePermission` | `jobs` | `delete` |
| `jobs/[id]/tasks/route.ts` | GET/POST | `requirePermission` | `jobs` | `select`/`update` |
| `jobs/[id]/files/route.ts` | GET | `requirePermission` | `jobs` | `select` |
| `jobs/[id]/files/route.ts` | POST | `requirePermission` | `jobs` | `update` |
| `jobs/[id]/files/[fileId]/route.ts` | GET | `requirePermission` | `jobs` | `select` |
| `jobs/[id]/files/[fileId]/route.ts` | DELETE | `requirePermission` | `jobs` | `update` |
| `jobs/[id]/completion-checklist/route.ts` | GET | `requirePermission` | `jobs` | `select` |
| `dispatch/route.ts` | GET | `requirePermission` | `jobs` | `select` |
| `dispatch-plans/route.ts` | GET/POST | `requirePermission` | `jobs` | `select`/`update` |
| `dispatch-plans/[id]/route.ts` | GET/PATCH | `requirePermission` | `jobs` | `select`/`update` |
| `documents/route.ts` | GET/POST | `requirePermission` | `portal_memberships` | `select`/`insert` |
| `feedback/route.ts` | GET/POST | `requirePermission` | `feedback_reports` | `select`/`insert` |
| `feedback/[id]/route.ts` | GET/PATCH | `requirePermission` | `feedback_reports` | `select`/`update` |
| `feedback/bulk/route.ts` | POST | `requirePermission` | `feedback_reports` | `update` |
| `gc-issue-requests/route.ts` | GET/POST | `requirePermission` | `gc_issue_requests` | `select`/`insert` |
| `gc-issue-requests/[id]/route.ts` | GET/PATCH | `requirePermission` | `gc_issue_requests` | `select`/`update` |
| `import/[entity]/route.ts` | POST | `requirePermission` | `customers` | `insert` |
| `installed-systems/route.ts` | GET/POST | `requirePermission` | `installed_systems` | `select`/`insert` |
| `installed-systems/[id]/route.ts` | GET/PATCH/DELETE | `requirePermission` | `installed_systems` | `select`/`update`/`delete` |
| `knowledge-items/route.ts` | GET/POST | `requirePermission` | `knowledge_items` | `select`/`insert` |
| `knowledge-items/[id]/route.ts` | GET/PATCH/DELETE | `requirePermission` | `knowledge_items` | `select`/`update`/`delete` |
| `organizations/route.ts` | GET | `requirePermission` | `organizations` | `select` |
| `organizations/[id]/route.ts` | GET/PATCH | `requirePermission` | `organizations` | `select`/`update` |
| `portal-projects/route.ts` | GET/POST | `requirePermission` | `portal_projects` | `select`/`insert` |
| `reporting/route.ts` | GET | `requirePermission` | `jobs` | `select` |
| `reports/route.ts` | GET | `requirePermission` | `jobs` | `select` |
| `schedule-blocks/route.ts` | GET/POST | `requirePermission` | `jobs` | `select`/`update` |
| `daily-plans/route.ts` | GET/POST | `requirePermission` | `jobs` | `select`/`update` |
| `settings/users/route.ts` | GET/POST | `requirePermission` | `user_profiles` | `select`/`insert` |
| `settings/users/[id]/route.ts` | GET/PATCH/DELETE | `requirePermission` | `user_profiles` | `select`/`update`/`delete` |
| `settings/users/[id]/reset-password/route.ts` | POST | `requirePermission` | `user_profiles` | `update` |
| `admin/db-health/runs/route.ts` | GET | `requirePermission` | `db_health_check_runs` | `select` |
| `admin/db-health/runs/[id]/route.ts` | GET | `requirePermission` | `db_health_check_runs` | `select` |
| `admin/db-health/check/route.ts` | POST | Bearer token | n/a (CI) | n/a |
| `admin/smoke-test/route.ts` | POST | Bearer token | n/a (CI) | n/a |
| `auth/sign-out/route.ts` | POST | `requireApiSession` | n/a (session teardown) | n/a |
| `copilot/search/route.ts` | POST | `requireApiSession` | n/a (search) | n/a |

**Total route files:** 46
**Routes using `requirePermission`:** 42
**Routes using `requireApiSession`:** 2
**Routes using bearer token (CI exempt):** 2
**Unprotected routes:** 0

---

## 401 vs 403 Behavior

| Condition | HTTP Status | `error` field | `code` field | `reason` |
|-----------|-------------|---------------|--------------|----------|
| Missing token / invalid token / expired token / revoked session / missing role claim | **401** | `"UNAUTHORIZED"` | `401` | `missing_token`, `invalid_token`, `expired_token`, `revoked_session`, or `missing_role` |
| Identity resolved but role is not in the allowed set for the requested table × action | **403** | `"FORBIDDEN"` | `403` | `insufficient_permission` |

---

## Fail-Closed Guarantee

`requirePermission` is designed to fail closed:

1. If no session exists → 401.
2. If the role claim is missing or unrecognized → 401 (`missing_role`).
3. If the role is known but not in `PERMISSIONS[table][action]` → 403.
4. There is no default-allow path. Any unrecognized state yields a denial.

`requireApiSession` is similarly fail-closed: any Supabase error or absent user returns 401.

**Non-production backdoors** (`x-loop-role` header impersonation, missing-role auto-owner) are gated on `NODE_ENV !== "production"` server-side. Verified 2026-10-03: Vercel production does not set NODE_ENV explicitly; Next.js `next start` sets it to `production` automatically. No override variables present.

---

## CI Guard

The test file `src/lib/__tests__/api-route-authz-coverage.test.ts` enforces coverage automatically:

- It scans all `route.ts` files under `src/app/api/` at test time.
- For each file, it asserts that either `requirePermission` or `requireApiSession` appears in the source text, or the file is in `EXEMPT_ROUTES`.
- Routes with no auth call are listed as violations and the test fails.

---

## Known Gaps (Defense in Depth)

| Item | Status | Notes |
|------|--------|-------|
| RLS role-scoping on `installed_systems`, `job_tasks` | Open | Policies are org-scoped (`FOR ALL`) but not role-scoped. App layer (`requirePermission`) enforces roles on every endpoint; RLS does not double-check. Tightening requires role-aware policies. |
| Tech job visibility `EXISTS` clause | Open | The widened jobs policy OR-clause lacks an explicit org check inside `EXISTS` (relies on `job_assignees` org consistency). |
| Column-level enforcement for dispatch/tech job UPDATE | Deferred | Application-layer enforcement; Supabase + PostgreSQL 15+ column security not yet wired. |

---

## Changelog

- **2.0 (2026-10-03):** Full re-inventory — all 46 route files mapped (was 20). Added bearer-token CI endpoints, file delete route, warranty registration PATCH, settings/users routes. Documented Vercel NODE_ENV verification and known RLS gaps.
- **1.0 (2026-07-25):** Initial inventory (20 endpoints, Sprint 26).
