# Database Schema — Source of Truth

## Single Source of Truth

**`supabase/migrations/`** is the single source of truth for all database schema in this repository.

This decision was established by the baseline synchronization in this PR.  From this point forward:

- All schema changes **must originate as a new file in `supabase/migrations/`** using the naming convention `YYYYMMDDHHMMSS_short_description.sql`.
- The `database/migrations/` and `database/policies/` folders are **read-only reference material** and must not diverge from `supabase/migrations/`.  Do not apply files from those folders directly to any environment.
- Every new table requires a corresponding RLS enable + allow policies in the same migration file (or a follow-up migration immediately after).

---

## Migration Sequence

| File | Contents |
|---|---|
| `supabase/migrations/20240101000000_initial_schema.sql` | Extension enablement (`uuid-ossp`, `pgcrypto`) |
| `supabase/migrations/20260719000001_baseline_core_schema.sql` | Core tables, `current_org_id()` / `current_app_role()` helpers, RLS + role policies for all core tables |
| `supabase/migrations/20260720000001_wave2_domains.sql` | Daily Plans, Dispatch, Installed Systems — tables + RLS |
| `supabase/migrations/20260721014500_property_artifacts.sql` | `property_documents`, `property_photos` — tables + RLS |
| `supabase/migrations/20260721023800_organizations_soft_delete.sql` | `organizations.deleted_at` soft-delete column |
| `supabase/migrations/20260721060000_sprint27_platform_services.sql` | Storage, GC Issues, Knowledge, Portal Projects, Performance Models — tables + RLS |

---

## Gap Audit (pre-PR state → action taken)

The table below documents every schema object that was expected by the application but missing from `supabase/migrations/` before this PR.

| Object | Expected | Pre-PR Actual | Action |
|---|---|---|---|
| `organizations` table | exists | **missing** from supabase/migrations | Added in `20260719000001` |
| `user_profiles` table | exists | **missing** | Added in `20260719000001` |
| `user_profiles.org_id` | exists | **missing** | Added in `20260719000001` |
| `user_profiles.app_role` | exists | **missing** | Added in `20260719000001` |
| `customers` table | exists | **missing** | Added in `20260719000001` |
| `customers.org_id` | exists | **missing** | Added in `20260719000001` |
| `properties` table | exists | **missing** | Added in `20260719000001` |
| `properties.org_id` | exists | **missing** | Added in `20260719000001` |
| `contractors` table | exists | **missing** | Added in `20260719000001` |
| `jobs` table | exists | **missing** | Added in `20260719000001` |
| `jobs.org_id` | exists | **missing** | Added in `20260719000001` |
| `jobs.assigned_user_id` | exists | **missing** | Added in `20260719000001` |
| `job_activity` table | exists | **missing** | Added in `20260719000001` |
| `portal_users` table | exists | **missing** | Added in `20260719000001` |
| `portal_memberships` table | exists | **missing** | Added in `20260719000001` |
| `current_org_id()` function | exists | **missing** | Added in `20260719000001` |
| `current_app_role()` function | exists | **missing** | Added in `20260719000001` |
| RLS on `organizations` | enabled | **missing** | Added in `20260719000001` |
| RLS on `user_profiles` | enabled | **missing** | Added in `20260719000001` |
| RLS on `customers` | enabled | **missing** | Added in `20260719000001` |
| RLS on `properties` | enabled | **missing** | Added in `20260719000001` |
| RLS on `contractors` | enabled | **missing** | Added in `20260719000001` |
| RLS on `jobs` | enabled | **missing** | Added in `20260719000001` |
| RLS on `job_activity` | enabled | **missing** | Added in `20260719000001` |
| RLS on `portal_users` | enabled | **missing** | Added in `20260719000001` |
| RLS on `portal_memberships` | enabled | **missing** | Added in `20260719000001` |
| Role policies for core tables | exists | **missing** | Added in `20260719000001` |
| `daily_plan_notes` table | exists | exists (20260720000001) | no change |
| `dispatch_plans` table | exists | exists (20260720000001) | no change |
| `crews` table | exists | exists (20260720000001) | no change |
| `installed_systems` table | exists | exists (20260720000001) | no change |
| RLS on wave2 tables | enabled | exists (20260720000001) | no change |
| `property_documents` table | exists | exists (20260721014500) | no change |
| `property_photos` table | exists | exists (20260721014500) | no change |
| `organizations.deleted_at` | exists | exists (20260721023800) | no change |
| `storage_objects` table | exists | **missing** | Added in `20260721060000` |
| `gc_issue_requests` table | exists | **missing** | Added in `20260721060000` |
| `gc_issue_attachments` table | exists | **missing** | Added in `20260721060000` |
| `knowledge_items` table | exists | **missing** | Added in `20260721060000` |
| `knowledge_relationships` table | exists | **missing** | Added in `20260721060000` |
| `knowledge_usage` table | exists | **missing** | Added in `20260721060000` |
| `portal_projects` table | exists | **missing** | Added in `20260721060000` |
| `portal_milestones` table | exists | **missing** | Added in `20260721060000` |
| `portal_documents` table | exists | **missing** | Added in `20260721060000` |
| `portal_photos` table | exists | **missing** | Added in `20260721060000` |
| `performance_models` table | exists | **missing** | Added in `20260721060000` |
| RLS on sprint 27 tables | enabled | **missing** | Added in `20260721060000` |

---

## Adding a New Table (updated workflow)

1. Create a new file in **`supabase/migrations/`** named `YYYYMMDDHHMMSS_short_description.sql`.
2. Include `org_id uuid NOT NULL REFERENCES organizations(id)` and any relevant user FK columns.
3. Enable RLS with `ALTER TABLE … ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;` in the same file.
4. Add allow policies scoped to `current_org_id()` and `current_app_role()` — least-privilege, no broader access than the use case requires.
5. Update `docs/architecture/security/rls-role-matrix.md` with the new table row.
6. Update the gap-audit table in this file.
7. Run `bash scripts/verify-migrations.sh` to confirm file-level hygiene.
8. After applying, run `scripts/verify-schema.sql` in the Supabase SQL editor to confirm the schema contract.

---

## Authorization Model

All policies are scoped using the helper functions defined in `20260719000001_baseline_core_schema.sql`:

- **`current_org_id()`** — resolves `user_profiles.org_id` for `auth.uid()`; ensures every row access is scoped to the authenticated user's organisation.
- **`current_app_role()`** — resolves `user_profiles.app_role` for `auth.uid()`; drives least-privilege role gating.

Policies follow the deny-by-default model: RLS is `FORCE`d on every table, and no row is accessible unless an explicit `PERMISSIVE` policy matches. Portal users (`app_role = 'portal'`) are fully isolated from all internal operational tables.

For the full role × table × action matrix see [`docs/architecture/security/rls-role-matrix.md`](security/rls-role-matrix.md).

---

## Post-Migration Verification

After applying migrations to any environment, run `scripts/verify-schema.sql` to confirm:

1. All required tables exist.
2. All required columns exist.
3. RLS is enabled on every table.
4. Helper functions are present.

```bash
# Against local Supabase
psql "$DATABASE_URL" -f scripts/verify-schema.sql

# Or paste the file into the Supabase SQL Editor.
```

Any row with `status = 'MISSING'` or `rls_status != 'RLS_ENABLED'` indicates drift; author a new forward migration to resolve it.
