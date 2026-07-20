# RLS Role Matrix — LOOP Internal Operations
**Version:** 1.0  
**Sprint:** 24  
**Status:** Approved  
**Last updated:** 2026-07-20

This document is the **single source of truth** for the LOOP internal operations permission model. The SQL policies in `database/policies/002_role_policies.sql` and the TypeScript contract in `src/services/authorization.ts` are both derived from this matrix.

For the external portal permission model (homeowner, GC, builder, property_manager roles), see [`docs/architecture/project-portal/authorization-matrix.md`](../project-portal/authorization-matrix.md).

---

## Role Definitions

| Role       | Who                        | Scope                                      |
|------------|----------------------------|--------------------------------------------|
| `owner`    | Company owner              | Full read/write on all internal tables     |
| `manager`  | Operations / office manager | Full operational r/w, no hard-delete      |
| `dispatch` | Dispatcher                 | Read operational data, update job status   |
| `tech`     | Field technician           | Read/update **own assigned** jobs only     |
| `office`   | Office staff               | Create/read customers & properties, read jobs |
| `sales`    | Sales team                 | Manage customers & properties, read jobs   |
| `portal`   | External portal user       | Isolated — no access to any internal table |

**Portal isolation rule:** Users with the `portal` app_role are external stakeholders. They cannot access any internal operational table (`jobs`, `customers`, `properties`, `contractors`, `job_activity`). Access is exclusively through `portal_users` / `portal_memberships` tables.

---

## Permission Matrix

Legend: `✓` = allowed | `own` = own rows only | `status` = status column only (app-layer enforcement) | `—` = denied

### customers

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | —    | ✓      | ✓     | —      |
| INSERT | ✓     | ✓       | —        | —    | ✓      | ✓     | —      |
| UPDATE | ✓     | ✓       | —        | —    | ✓      | ✓     | —      |
| DELETE | ✓     | —       | —        | —    | —      | —     | —      |

### properties

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | ✓    | ✓      | ✓     | —      |
| INSERT | ✓     | ✓       | —        | —    | ✓      | ✓     | —      |
| UPDATE | ✓     | ✓       | —        | —    | ✓      | ✓     | —      |
| DELETE | ✓     | —       | —        | —    | —      | —     | —      |

### contractors

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | ✓    | —      | —     | —      |
| INSERT | ✓     | ✓       | —        | —    | —      | —     | —      |
| UPDATE | ✓     | ✓       | —        | —    | —      | —     | —      |
| DELETE | ✓     | —       | —        | —    | —      | —     | —      |

### jobs

| Action | owner | manager | dispatch | tech      | office | sales | portal |
|--------|-------|---------|----------|-----------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | own       | ✓      | ✓     | —      |
| INSERT | ✓     | ✓       | —        | —         | ✓      | —     | —      |
| UPDATE | ✓     | ✓       | status   | own+status| —      | —     | —      |
| DELETE | ✓     | —       | —        | —         | —      | —     | —      |

> **dispatch / tech UPDATE note:** Dispatch and tech may update job rows at the RLS layer. Column-level restriction (only `status` may be changed) is enforced at the application service layer, not via RLS, because Supabase column-level security requires PostgreSQL 15+. This is documented here so the application layer can be audited independently.

### job_activity

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | own  | ✓      | —     | —      |
| INSERT | ✓     | ✓       | ✓        | own  | —      | —     | —      |
| UPDATE | —     | —       | —        | —    | —      | —     | —      |
| DELETE | —     | —       | —        | —    | —      | —     | —      |

> **Append-only:** `job_activity` is an immutable audit log. No role may UPDATE or DELETE rows.

### portal_users

| Action | owner | manager | dispatch | tech | office | sales | portal (own row) |
|--------|-------|---------|----------|------|--------|-------|-----------------|
| SELECT | ✓     | ✓       | —        | —    | —      | —     | own             |
| INSERT | ✓     | ✓       | —        | —    | —      | —     | —               |
| UPDATE | ✓     | ✓       | —        | —    | —      | —     | own             |
| DELETE | ✓     | —       | —        | —    | —      | —     | —               |

### portal_memberships

| Action | owner | manager | dispatch | tech | office | sales | portal (own row) |
|--------|-------|---------|----------|------|--------|-------|-----------------|
| SELECT | ✓     | ✓       | —        | —    | —      | —     | own             |
| INSERT | ✓     | ✓       | —        | —    | —      | —     | —               |
| UPDATE | ✓     | ✓       | —        | —    | —      | —     | —               |
| DELETE | ✓     | —       | —        | —    | —      | —     | —               |

---

## Deny Rules — Hard Blocks

The following are always blocked regardless of role or policy evaluation:

| Artifact / Pattern | Reason |
|--------------------|--------|
| Any `portal` role accessing `jobs`, `customers`, `properties`, `contractors`, `job_activity` | Portal isolation — external users must never see internal operational data |
| `anon` / unauthenticated requests | No ALLOW policy matches; RLS deny-by-default blocks all access |
| Cross-org row access | Every policy gates on `org_id = current_org_id()`; cross-org data is structurally impossible |
| `job_activity` UPDATE / DELETE | Log is append-only; no policy grants these operations |
| `dispatch` INSERT on jobs | Dispatchers schedule/update work, not create it |
| `tech` INSERT on jobs | Technicians execute work, not create it |
| `sales` INSERT/UPDATE on jobs | Sales own pre-sales data (customers, properties), not job execution |

---

## Multi-Tenant Org Isolation

Every table contains an `org_id` column. Every policy expression includes:

```sql
AND org_id = current_org_id()
```

`current_org_id()` is a `SECURITY DEFINER` function that resolves the calling user's org from `user_profiles`. This means:

- A user cannot see rows in a different org even if they guess a valid UUID.
- An application bug that omits org filtering in a query is caught by RLS at the database layer.

---

## Privilege Escalation — Tested Scenarios

The automated tests in `src/services/__tests__/authorization.test.ts` cover:

1. `portal` cannot access any internal operational table (all actions denied)
2. `tech` cannot access another tech's assigned jobs
3. `dispatch` cannot INSERT or DELETE jobs
4. `sales` cannot access contractors
5. `office` cannot access contractors
6. No role except `owner` can DELETE customers, properties, contractors, or jobs
7. No role can UPDATE or DELETE `job_activity`
8. `anon` (no role) is denied everything

---

## API Authorization Layer (Sprint 25–26)

The authorization contract in `src/services/authorization.ts` is now enforced at the Next.js API boundary via `src/lib/api-auth.ts`. A full endpoint-to-policy inventory, including CI guard documentation, lives at [`docs/architecture/security/endpoint-authz-inventory.md`](./endpoint-authz-inventory.md).

### Endpoint → Table/Action Mapping

| Endpoint | Method | Auth primitive | Table | Action |
|----------|--------|---------------|-------|--------|
| `/api/customers` | GET | `requirePermission` | `customers` | `select` |
| `/api/customers` | POST | `requirePermission` | `customers` | `insert` |
| `/api/customers/[id]` | GET | `requirePermission` | `customers` | `select` |
| `/api/customers/[id]` | PATCH | `requirePermission` | `customers` | `update` |
| `/api/customers/[id]` | DELETE | `requirePermission` | `customers` | `delete` |
| `/api/properties` | GET | `requirePermission` | `properties` | `select` |
| `/api/properties` | POST | `requirePermission` | `properties` | `insert` |
| `/api/properties/[id]` | GET | `requirePermission` | `properties` | `select` |
| `/api/properties/[id]` | PATCH | `requirePermission` | `properties` | `update` |
| `/api/properties/[id]` | DELETE | `requirePermission` | `properties` | `delete` |
| `/api/jobs` | GET | `requirePermission` | `jobs` | `select` |
| `/api/jobs` | POST | `requirePermission` | `jobs` | `insert` |
| `/api/jobs/[id]` | GET | `requirePermission` | `jobs` | `select` |
| `/api/jobs/[id]` | PATCH | `requirePermission` | `jobs` | `update` |
| `/api/jobs/[id]` | DELETE | `requirePermission` | `jobs` | `delete` |
| `/api/dispatch` | GET | `requirePermission` | `jobs` | `select` |
| `/api/documents` | GET | `requirePermission` | `portal_memberships` | `select` |
| `/api/documents` | POST | `requirePermission` | `portal_memberships` | `insert` |
| `/api/copilot/search` | POST | `requireApiSession` | n/a (search) | n/a |
| `/api/auth/sign-out` | POST | `requireApiSession` | n/a (session teardown) | n/a |

### Error Response Format

All authorization failures return a consistent JSON envelope:

```json
// 401 — unauthenticated
{ "error": "UNAUTHORIZED", "message": "...", "code": 401 }

// 403 — authenticated but insufficient role
{ "error": "FORBIDDEN", "message": "Role 'X' is not permitted to perform 'Y' on 'Z'.", "code": 403 }
```

### Role Resolution (current)

The `resolveRequestRole` function in `src/lib/api-auth.ts` reads the `X-Loop-Role` request header during development and testing. When Supabase auth is wired, this function will be extended to verify the JWT ****** and extract the `app_role` claim. No other code changes are required.

### Audit Events

Every sensitive mutation (POST/PATCH/DELETE) emits a structured log event via `src/lib/audit.ts`:

```
[AUDIT] {"role":"owner","action":"create","resource":"jobs","resourceId":"","details":{},"timestamp":"..."}
```

When Supabase persistence is wired, `emitAuditEvent` will be extended to write to `job_activity` or a dedicated `audit_log` table.

### Frontend Permission Gates

The `PermissionGate` component (`src/features/auth/PermissionGate.tsx`) is used in key screens to hide restricted actions. Role is resolved client-side from `localStorage` (`loop_dev_role` key, default `owner`) via `RoleProvider`. No action is rendered until the role is confirmed — preventing any flash of unauthorized content.

Gated UI elements:

| Screen | Element | Table | Action |
|--------|---------|-------|--------|
| `/jobs` | New Job button | `jobs` | `insert` |
| `/jobs/[id]` | Edit Job link | `jobs` | `update` |
| `/jobs/[id]` | Job status actions panel | `jobs` | `update` |
| `/customers` | New Customer button | `customers` | `insert` |
| `/properties` | New Property button | `properties` | `insert` |

---

## Deferred Scope (Post Sprint 24)

| Item | Notes |
|------|-------|
| Column-level security for dispatch/tech UPDATE on jobs | Requires PostgreSQL 15+ or application-layer enforcement until migrated |
| `inventory` table policies | Added when inventory transitions off mock storage |
| `dispatch_plans` table policies | Added when dispatch transitions off mock storage |
| Per-column audit triggers | To track which field changed in a job UPDATE |
| Rate limiting by role | Future Supabase Edge Function concern |
| Supabase JWT claim extraction in `resolveRequestRole` | Replace header-based role resolution with real session auth |
