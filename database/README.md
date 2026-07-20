# LOOP — Database

This folder contains all Supabase database artifacts for LOOP.

Migrations and policies are designed to be applied sequentially via the Supabase CLI or applied manually through the Supabase SQL Editor.

---

## Folder Structure

```
database/
  migrations/      — table definitions; apply in numeric order
  policies/        — RLS baseline and per-role allow policies; apply after migrations
  fixtures/        — deterministic baseline + golden-path seed fixtures
```

---

## Apply Order

1. `migrations/001_core_schema.sql` — creates core operational tables with `org_id` (multi-tenant isolation) and user reference columns (e.g. `assigned_user_id` in jobs, `actor_id` in job_activity) used by policy expressions
2. `policies/001_rls_baseline.sql` — enables RLS on every core table and installs deny-by-default guards
3. `policies/002_role_policies.sql` — installs explicit ALLOW policies for each internal role

---

## Role Definitions

Roles are assigned via a custom JWT claim `app_role` set by the Supabase Auth hook.

| Role       | Description                                         |
|------------|-----------------------------------------------------|
| `owner`    | Company owner — full read/write on all tables       |
| `manager`  | Office manager — full operational access, no delete |
| `dispatch` | Dispatcher — read operational data, update job status |
| `tech`     | Field technician — read/update own assigned jobs    |
| `office`   | Office staff — create/read customers and properties |
| `sales`    | Sales team — manage customers and properties        |
| `portal`   | External portal user — isolated from internal data  |

For the full permission matrix, see [`docs/architecture/security/rls-role-matrix.md`](../docs/architecture/security/rls-role-matrix.md).

---

## Security Posture

- **Deny-by-default.** Every table's RLS is `FORCE ROW LEVEL SECURITY`. Unless an explicit ALLOW policy matches, the row is denied.
- **No role escalation.** Portal users cannot access any internal operational table regardless of how policies are stacked.
- **Org isolation.** All internal policies scope to `org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())`. Cross-org data never appears.
- **Anon block.** Unauthenticated requests match no ALLOW policy and are fully blocked.

---

## Adding a New Table

1. Create a new numbered migration file in `migrations/`.
2. Include `org_id uuid NOT NULL REFERENCES organizations(id)` and (where applicable) `user_id uuid NOT NULL REFERENCES auth.users(id)`.
3. Add RLS enable + deny-by-default to `policies/001_rls_baseline.sql` (or a new baseline extension file).
4. Add per-role ALLOW policies to `policies/002_role_policies.sql` (or a new role extension file).
5. Update `docs/architecture/rls-role-matrix.md` with the new table row.
6. Add tests to `src/services/__tests__/authorization.test.ts` covering the new table.

---

## Deterministic Seeds

Deterministic operational fixtures live in `database/fixtures/` and are applied via:

- `npm run db:seed`
- `npm run db:reset`
- `npm run db:reseed`

See [`docs/database-seeding.md`](../docs/database-seeding.md) for fixture conventions, safety guardrails, and CI usage.
