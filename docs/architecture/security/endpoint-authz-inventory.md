# Endpoint Authorization Inventory — LOOP API
**Version:** 1.0  
**Sprint:** 26  
**Status:** Approved  
**Last updated:** 2026-07-20

This document is the committed, source-of-truth inventory of every LOOP API endpoint and its authorization mapping. It satisfies the Sprint 26 acceptance criteria for "endpoint inventory exists and is committed" and "100% of in-scope sensitive actions have explicit policy mapping."

The automated test at `src/lib/__tests__/api-route-authz-coverage.test.ts` enforces that every `route.ts` file under `src/app/api/` either calls an approved authorization primitive or is explicitly listed in the `EXEMPT_ROUTES` registry inside that test. **CI fails if a new protected route is introduced without a mapping.**

For the underlying role × table × action permission matrix, see [`rls-role-matrix.md`](./rls-role-matrix.md).

---

## Authorization Primitives

| Primitive | Location | Purpose |
|-----------|----------|---------|
| `requirePermission(request, table, action)` | `src/lib/api-auth.ts` | Role-based gate for all data-layer CRUD routes. Returns `{ ok: true, ctx }` or `{ ok: false, response }`. |
| `requireApiSession()` | `src/lib/auth/apiGuard.ts` | Session-only gate for routes that verify identity without a table/action scope (e.g. search, sign-out). |

---

## Endpoint Inventory

### Standard error envelope

All authorization failures return a consistent JSON envelope regardless of which primitive is used:

```json
// 401 — unauthenticated
{ "error": "UNAUTHORIZED", "message": "...", "code": 401 }

// 403 — authenticated, insufficient role
{ "error": "FORBIDDEN", "message": "Role 'X' is not permitted to perform 'Y' on 'Z'.", "code": 403 }
```

### Endpoint × Method → Authorization mapping

| Route file | Method | Auth primitive | Table | Action | Min. allowed roles |
|-----------|--------|---------------|-------|--------|--------------------|
| `customers/route.ts` | GET | `requirePermission` | `customers` | `select` | owner, manager, dispatch, office, sales |
| `customers/route.ts` | POST | `requirePermission` | `customers` | `insert` | owner, manager, office, sales |
| `customers/[id]/route.ts` | GET | `requirePermission` | `customers` | `select` | owner, manager, dispatch, office, sales |
| `customers/[id]/route.ts` | PATCH | `requirePermission` | `customers` | `update` | owner, manager, office, sales |
| `customers/[id]/route.ts` | DELETE | `requirePermission` | `customers` | `delete` | owner |
| `properties/route.ts` | GET | `requirePermission` | `properties` | `select` | owner, manager, dispatch, tech, office, sales |
| `properties/route.ts` | POST | `requirePermission` | `properties` | `insert` | owner, manager, office, sales |
| `properties/[id]/route.ts` | GET | `requirePermission` | `properties` | `select` | owner, manager, dispatch, tech, office, sales |
| `properties/[id]/route.ts` | PATCH | `requirePermission` | `properties` | `update` | owner, manager, office, sales |
| `properties/[id]/route.ts` | DELETE | `requirePermission` | `properties` | `delete` | owner |
| `jobs/route.ts` | GET | `requirePermission` | `jobs` | `select` | owner, manager, dispatch, tech, office, sales |
| `jobs/route.ts` | POST | `requirePermission` | `jobs` | `insert` | owner, manager, office |
| `jobs/[id]/route.ts` | GET | `requirePermission` | `jobs` | `select` | owner, manager, dispatch, tech, office, sales |
| `jobs/[id]/route.ts` | PATCH | `requirePermission` | `jobs` | `update` | owner, manager, dispatch, tech |
| `jobs/[id]/route.ts` | DELETE | `requirePermission` | `jobs` | `delete` | owner |
| `dispatch/route.ts` | GET | `requirePermission` | `jobs` | `select` | owner, manager, dispatch, tech, office, sales |
| `documents/route.ts` | GET | `requirePermission` | `portal_memberships` | `select` | owner, manager, portal (own rows) |
| `documents/route.ts` | POST | `requirePermission` | `portal_memberships` | `insert` | owner, manager |
| `copilot/search/route.ts` | POST | `requireApiSession` | n/a (search) | n/a | Any authenticated user |
| `auth/sign-out/route.ts` | POST | `requireApiSession` | n/a (session teardown) | n/a | Any authenticated user |

**Total routes:** 20  
**Routes using `requirePermission`:** 18  
**Routes using `requireApiSession`:** 2  
**Unprotected / exempt routes:** 0

---

## 401 vs 403 Behavior

| Condition | HTTP Status | `error` field | `code` field |
|-----------|-------------|---------------|--------------|
| No identity (missing or invalid `X-Loop-Role` header / no Supabase session) | **401** | `"UNAUTHORIZED"` | `401` |
| Identity resolved but role is not in the allowed set for the requested table × action | **403** | `"FORBIDDEN"` | `403` |

This behavior is consistent across all 20 endpoints. Both `requirePermission` (via `src/lib/api-auth.ts`) and `requireApiSession` (via `src/lib/auth/apiGuard.ts`) use the same envelope format.

---

## Fail-Closed Guarantee

`requirePermission` is designed to fail closed:

1. If no role header is present → `resolveRequestRole` returns `null` → 401.  
2. If the header value is not a recognized `AppRole` → `isAppRole` returns `false` → `null` → 401.  
3. If the role is known but not in `PERMISSIONS[table][action]` → `hasPermission` returns `false` → 403.  
4. There is no default-allow path. Any unrecognized state yields a denial.

`requireApiSession` is similarly fail-closed: any Supabase error or absent user returns 401.

---

## CI Guard

The test file `src/lib/__tests__/api-route-authz-coverage.test.ts` enforces coverage automatically:

- It scans all `route.ts` files under `src/app/api/` at test time.
- For each file, it asserts that either `requirePermission` or `requireApiSession` appears in the source text.
- Routes with no auth call are listed as violations and the test fails.
- Intentionally public routes can be added to the `EXEMPT_ROUTES` registry inside the test with a documented justification.

**To introduce a new protected route:**
1. Call `requirePermission` or `requireApiSession` at the top of every HTTP handler.
2. No changes to the test or this inventory are required; the coverage guard passes automatically.
3. Update this inventory table in the same commit as a documentation artifact.

**To introduce an intentionally public route:**
1. Add its relative path and justification to `EXEMPT_ROUTES` in the test file.
2. Add a row to the inventory table above with `n/a` in the auth column and a justification.

---

## Deferred / Out-of-Scope

| Item | Notes |
|------|-------|
| Column-level enforcement for dispatch/tech job UPDATE | Application-layer enforcement when Supabase + PostgreSQL 15+ column security is wired |
| Supabase JWT `app_role` extraction in `resolveRequestRole` | Header-based role is used in dev/test; JWT verification stub is in `api-auth.ts` |
| Rate limiting by role | Future Supabase Edge Function scope |
| `inventory` and `dispatch_plans` table policies | Added when those features transition off mock storage |
