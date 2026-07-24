# Migration Verification Files

Every migration in `supabase/migrations/` **must** have a corresponding
verification file in this directory.

---

## Naming convention

| Migration file | Verification file |
|---|---|
| `supabase/migrations/YYYYMMDDHHMMSS_desc.sql` | `supabase/verifications/YYYYMMDDHHMMSS_desc.verify.sql` |

The timestamp and description must match exactly. Only the extension changes
(`.sql` → `.verify.sql`).

---

## Purpose

A verification file is **read-only SQL** that asserts the intended structural
and security outcomes of its paired migration. It is **not** applied as part of
the migration; it is run after the migration to confirm that the schema
contract is satisfied.

Each assertion uses a `DO $$ BEGIN ASSERT …; END; $$;` block so that failures
raise an exception and produce a non-zero exit code when executed via `psql`.

---

## When to run

```bash
# Run a single migration's verification after applying it
psql "$DATABASE_URL" -f supabase/verifications/YYYYMMDDHHMMSS_desc.verify.sql

# Or paste the file into the Supabase SQL Editor.
```

Verification files are also checked structurally (presence only) by
`scripts/verify-migrations.sh` on every PR — no database credentials needed
for that step.

---

## Writing a verification file

See `supabase/migration-template.sql` for the full migration + verification
authoring workflow.

### Common assertion patterns

**Table exists**
```sql
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'my_table'
  ), 'my_table must exist';
END; $$;
```

**Column exists**
```sql
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'my_table'
      AND column_name  = 'my_column'
  ), 'my_table.my_column must exist';
END; $$;
```

**RLS enabled**
```sql
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'my_table'
      AND c.rowsecurity = true
  ), 'RLS must be enabled on my_table';
END; $$;
```

**Policy exists**
```sql
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'my_table'
      AND policyname = 'my_table: org read'
  ), 'my_table: org read policy must exist';
END; $$;
```

**Index exists**
```sql
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'my_table'
      AND indexname  = 'my_table_org_id_idx'
  ), 'my_table_org_id_idx index must exist';
END; $$;
```

**Extension installed**
```sql
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
  ), 'uuid-ossp extension must be installed';
END; $$;
```

---

## CI enforcement

`scripts/verify-migrations.sh` (Check 5) fails if any migration file does not
have a matching `.verify.sql` in this directory. This check runs on every PR
and requires no database credentials.
