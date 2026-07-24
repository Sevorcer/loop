# Migration Verification Standard

**Track:** Platform Stabilization → S2 Migration Verification  
**Issue:** #118  
**Status:** Enforced (CI check active)

---

## Overview

Every migration in `supabase/migrations/` **must** be accompanied by a
verification file in `supabase/verifications/`. The verification file is
read-only SQL that asserts the intended structural and security outcomes of
the migration. It is not applied as part of the migration — it is run after
the migration is applied to confirm the schema contract is satisfied.

This standard is machine-enforced: `scripts/verify-migrations.sh` (Check 5)
fails on any PR where a migration file does not have a matching
`.verify.sql`. No database credentials are required for this check.

---

## File naming convention

| Migration | Verification |
|---|---|
| `supabase/migrations/YYYYMMDDHHMMSS_desc.sql` | `supabase/verifications/YYYYMMDDHHMMSS_desc.verify.sql` |

The timestamp and description must be identical to the migration file. Only
the extension changes (`.sql` → `.verify.sql`).

---

## What to assert

Each verification file must assert every **structural and security outcome**
of its migration. Use the checklist below as a guide:

| Change type | Required assertions |
|---|---|
| New table | Table exists; required columns exist; RLS enabled; org-scoped read policy exists; org-scoped write policy exists |
| New column | Column exists; data type and nullability are correct |
| New index | Index exists by exact `indexname` |
| RLS / policy change | Named policies exist in `pg_policies` |
| New function | Function exists in `information_schema.routines` |
| New extension | Extension exists in `pg_extension` |

---

## Assertion format

Use `DO $$ BEGIN ASSERT …; END; $$;` blocks. A failed assertion raises a
Postgres exception, producing a non-zero `psql` exit code that CI can detect.

Group related assertions into a single `DO` block to minimise noise, but keep
each block focused on one category (tables, columns, RLS, policies, indexes).

### Examples

#### Column add

```sql
-- Asserts the new column was added with the correct type and nullability.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organizations'
      AND column_name  = 'deleted_at'
      AND is_nullable  = 'YES'
      AND data_type    = 'timestamp with time zone'
  ), 'organizations.deleted_at must be a nullable timestamptz';
END; $$;
```

#### Policy change

```sql
-- Asserts the intended RLS policy is present by exact name.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'property_documents'
      AND policyname = 'property_documents: org read'
  ), 'property_documents: org read policy must exist';
END; $$;
```

#### Index add

```sql
-- Asserts the index was created with the expected name.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'organizations'
      AND indexname  = 'organizations_deleted_at_idx'
  ), 'organizations_deleted_at_idx partial index must exist';
END; $$;
```

#### New table with RLS

```sql
-- Tables exist
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'my_table'), 'my_table must exist';
END; $$;

-- RLS enabled
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'my_table' AND c.rowsecurity = true
  ), 'RLS must be enabled on my_table';
END; $$;

-- Policies present
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'my_table' AND policyname = 'my_table: org read'),  'my_table: org read policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'my_table' AND policyname = 'my_table: org write'), 'my_table: org write policy must exist';
END; $$;
```

---

## Running verification files

```bash
# After applying a migration, verify it against the live database:
psql "$DATABASE_URL" -f supabase/verifications/YYYYMMDDHHMMSS_desc.verify.sql

# Or paste the file content into the Supabase SQL Editor.
```

`psql` exits non-zero if any assertion fails — the error message includes the
assertion description so failures are immediately actionable.

---

## CI enforcement

`scripts/verify-migrations.sh` runs on every PR that touches migration or
verification files. Check 5 (verification file required) will fail and block
merge if any migration in `supabase/migrations/` does not have a matching
`.verify.sql` in `supabase/verifications/`. No database credentials are
needed for this check.

The GitHub Actions workflow at `.github/workflows/db-migrations.yml` also
triggers on changes to `supabase/verifications/**`.

---

## Authoring workflow

Use `supabase/migration-template.sql` as the starting point for every new
migration. The template includes a `POST-MIGRATION CHECKLIST` section that
reminds you to create the companion `.verify.sql` before opening a PR.

1. Generate a new migration file:
   ```bash
   supabase migration new <short_description>
   ```
2. Copy the structure from `supabase/migration-template.sql`.
3. Write the migration DDL.
4. Create `supabase/verifications/<TIMESTAMP>_<description>.verify.sql`.
5. Write assertions for every structural and security outcome.
6. Run the hygiene check (no DB needed):
   ```bash
   bash scripts/verify-migrations.sh
   ```
7. Apply and run the verification against the live database:
   ```bash
   supabase db push
   psql "$DATABASE_URL" -f supabase/verifications/<TIMESTAMP>_<description>.verify.sql
   ```

---

## References

- Verification files: `supabase/verifications/`
- Migration template: `supabase/migration-template.sql`
- CI hygiene script: `scripts/verify-migrations.sh`
- Migration runbook: `docs/migration-runbook.md`
- Database source of truth: `docs/architecture/database-source-of-truth.md`
