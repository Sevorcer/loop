# Runbook: DB Drift Detection

Version: 1.0  
Last reviewed: 2026-07-24  
Owner: Engineering on-call  
Related issue: [#122](https://github.com/Sevorcer/loop/issues/122)

---

## Purpose

Detect schema and policy drift before deployment so that issues are caught
early with actionable output, rather than discovered through runtime failures in
production.

Drift means the live database no longer matches what the migration files
describe.  Categories of drift that LOOP detects:

| Category | What it means | Severity |
|---|---|---|
| Missing columns | A column defined in migrations is absent from the live table | CRITICAL |
| Missing RLS enablement | A table is missing `ENABLE ROW LEVEL SECURITY` | CRITICAL |
| Missing policies | An RLS policy defined in migrations is absent from `pg_policies` | CRITICAL |
| Missing helper functions | `current_org_id()` or `current_app_role()` not present | CRITICAL |
| Migration checksum mismatch | An already-committed migration file was modified in place | CRITICAL |
| Unapplied migrations | Local migration files not yet applied to the DB | CRITICAL |
| Schema diff | `supabase db diff --linked` reports un-captured out-of-band changes | CRITICAL |

---

## CI/CD Integration

Two workflows run drift detection automatically:

### `db-verify.yml` — Verification stage
- **Triggers**: every PR targeting `main`, every push to `main`
- **Purpose**: catch drift early in the review cycle
- **Secrets**:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_REF`
  - `SUPABASE_DB_PASSWORD`
- **Jobs**:
  - `verify-structure` — migration file naming, ordering, checksum integrity (no secrets)
  - `verify-schema` — linked-project schema and policy verification against the live DB
  - `drift-summary` — aggregates results

### `pre-deploy-gate.yml` — Deploy gate
- **Triggers**: push/PR to `main`
- **Purpose**: final blocker before production deployment
- **Jobs**:
  - `verify-structure` — migration structure (no secrets)
  - `db-drift-gate` — full drift gate including policy check (Check 4)

---

## Running Locally

### Prerequisites

```bash
# PostgreSQL client tools
brew install postgresql  # macOS
apt install postgresql-client  # Ubuntu/Debian

# Set the connection string (use Supabase direct or pooler URL)
export DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"
```

### Schema verification (tables, columns, RLS, helper functions)

```bash
npm run db:verify-schema
```

This runs `scripts/verify-schema.sql` via psql.  Output shows `OK` or `MISSING`
for each expected schema item.

**Sample output — no drift:**
```
 table_name    | status
--------------+--------
 customers    | OK
 jobs         | OK
 organizations| OK
 ...
(30 rows)
```

**Sample output — drift detected:**
```
 table_name          | column_name | status
--------------------+-------------+---------
 jobs               | priority    | MISSING
```

### Policy verification (RLS policy presence)

```bash
npm run db:verify-policies
```

This runs `scripts/verify-policies.sh`.  It dynamically parses policy names
from `supabase/migrations/*.sql` and compares against `pg_policies`.

**Sample output — no drift:**
```
════════════════════════════════════════════════════
  LOOP Policy Verification  v1.0
════════════════════════════════════════════════════
  Script : verify-policies.sh
  Started: 2026-07-24T12:00:00Z

── Step 1 — Parse expected policies from migration files ───────────────
  Found 99 expected policies across migration files

── Step 2 — Query live database for actual policies ────────────────────
  Found 99 actual policies in live database (public schema).

── Step 3 — Compare expected vs actual ─────────────────────────────────

════════════════════════════════════════════════════
  Policy Verification Summary
════════════════════════════════════════════════════
  Completed : 2026-07-24T12:00:01Z
  Expected  : 99
  Actual    : 99
  Missing   : 0
  Unexpected: 0

  ✓ No policy drift — all 99 expected policies are present.

── JSON Summary ────────────────────────────────────────────────────────

{
  "timestamp": "2026-07-24T12:00:01Z",
  "category": "policies",
  "status": "ok",
  "totalExpected": 99,
  "totalActual": 99,
  "missing": [],
  "unexpected": []
}
```

**Sample output — drift detected:**
```
  ✗ [MISSING] customers: delete for owner only
    → Policy is defined in a migration file but not found in pg_policies.
    → Remediation: ensure the migration containing this policy has been applied.
    → Run: supabase db push --linked

  ✗ POLICY DRIFT DETECTED — 1 expected policy/policies missing.

    Missing policies:
      - customers: delete for owner only

{
  "timestamp": "2026-07-24T12:00:01Z",
  "category": "policies",
  "status": "drift",
  "totalExpected": 99,
  "totalActual": 98,
  "missing": ["customers: delete for owner only"],
  "unexpected": []
}
```

Exit code is `1` on drift, `0` on no drift.

### Migration structure + checksum verification

```bash
npm run db:verify-migrations
# or
bash scripts/verify-migrations.sh
```

Checks:
1. Naming convention (`YYYYMMDDHHMMSS_description.sql`)
2. No duplicate timestamps
3. Ascending timestamp order
4. No empty files
5. Checksum integrity against `scripts/migration-checksums.sha256`

### Verbose policy output

```bash
VERBOSE=1 npm run db:verify-policies
```

Prints `✓` for every individual policy checked (instead of only showing failures).

### SQL editor version

Paste `scripts/verify-policies.sql` into the Supabase SQL Editor for a quick
tabular view of all expected vs actual policies.

---

## Remediation Steps

### Missing columns

1. Identify which migration introduced the column.
2. Check `supabase migration list --linked` for unapplied migrations.
3. Apply pending migrations:
   ```bash
   supabase db push --linked
   ```
4. Re-run `npm run db:verify-schema` to confirm.

### Missing RLS enablement

1. Check the relevant migration for `ENABLE ROW LEVEL SECURITY`.
2. If the migration was applied but RLS is still disabled, run manually:
   ```sql
   ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
   ```
3. Create a new migration to capture the fix:
   ```bash
   supabase migration new fix_rls_<table_name>
   ```

### Missing policies

1. Run `supabase migration list --linked` to identify unapplied migrations.
2. Apply pending migrations:
   ```bash
   supabase db push --linked
   ```
3. If the policy should exist but is genuinely absent, apply it manually then
   capture it in a new migration.
4. Re-run `npm run db:verify-policies` to confirm.

### Missing helper functions

1. Check that `20260719000001_baseline_core_schema.sql` has been applied.
2. Apply migrations if needed: `supabase db push --linked`.

### Migration checksum mismatch

A checksum mismatch means a committed migration file was changed after being
applied to the database.  This is a serious issue.

1. Identify the modified file from `sha256sum --check scripts/migration-checksums.sha256`.
2. Revert the change using `git checkout scripts/migration-checksums.sha256`.
   - If the migration content change was intentional, create a NEW migration
     that captures the delta instead of modifying the existing file.
3. **Never modify applied migrations in place** — always create a new migration.

To update checksums after legitimately adding a new migration:
```bash
bash scripts/update-migration-checksums.sh
git add scripts/migration-checksums.sha256
git commit -m "chore: update migration checksums for <new_migration>"
```

### Schema diff

If `supabase db diff --linked` reports changes:

1. Determine if the change was intentional (out-of-band hotfix) or accidental.
2. Capture the diff as a new migration:
   ```bash
   supabase db diff --linked --schema public -f fix_<description>
   ```
3. Review the generated SQL, commit, and push.

---

## Adding New Migrations

When adding a migration that introduces new policies:

1. Write the migration SQL in `supabase/migrations/`.
2. Apply the migration locally/staging: `supabase db push --linked`.
3. Update the checksum file:
   ```bash
   bash scripts/update-migration-checksums.sh
   ```
4. Update `scripts/verify-policies.sql` to include the new policy names.
5. Commit all four items together: the migration, checksums, SQL check file,
   and any updated documentation.

The `scripts/verify-policies.sh` script picks up new policies automatically
(it parses migration files at runtime), so no manual update is needed there.

---

## Machine-Readable Output

`npm run db:verify-policies` always emits a JSON block at the end of output:

```json
{
  "timestamp": "ISO-8601",
  "category": "policies",
  "status": "ok | drift",
  "totalExpected": <number>,
  "totalActual": <number>,
  "missing": ["policy name", ...],
  "unexpected": ["policy name", ...]
}
```

This can be parsed by downstream tooling or CI summary scripts.

---

## Related

- [Pre-Deploy DB Drift Gate](pre-deploy-gate.md) — deployment blocker
- [Migration Rollback Runbook](migration-rollback.md) — rollback procedure
- [Daily DB Health Check Runbook](db-health-check.md) — monitoring
- [RLS Role Matrix](../architecture/security/rls-role-matrix.md) — policy reference
