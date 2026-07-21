# LOOP — Database

> **⚠️ Reference only.**
> The single source of truth for all database schema is **`supabase/migrations/`**.
> Do not apply files from this folder directly to any environment.
> See [`docs/architecture/database-source-of-truth.md`](../docs/architecture/database-source-of-truth.md) for the full SSoT declaration and migration sequence.

This folder contains human-readable reference copies of the schema definitions that were used to author the canonical `supabase/migrations/` files.  It is retained for historical context and code review convenience only.

---

## Folder Structure

```
database/
  migrations/      — reference table definitions (do not apply directly)
  policies/        — reference RLS and role policies (do not apply directly)
  fixtures/        — deterministic baseline + golden-path seed fixtures
```

---

## Canonical Apply Order

Schema is applied exclusively through `supabase/migrations/`:

1. `supabase/migrations/20260719000001_baseline_core_schema.sql` — core tables, helper functions, RLS + role policies
2. `supabase/migrations/20260720000001_wave2_domains.sql` — Daily Plans, Dispatch, Installed Systems
3. `supabase/migrations/20260721014500_property_artifacts.sql` — property documents and photos
4. `supabase/migrations/20260721023800_organizations_soft_delete.sql` — soft-delete column
5. `supabase/migrations/20260721060000_sprint27_platform_services.sql` — storage, GC issues, knowledge, portal projects, performance models

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
