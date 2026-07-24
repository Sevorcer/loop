# Runbook: Daily DB Health Check

Version: 1.0  
Last reviewed: 2026-07-24  
Owner: Engineering on-call  
Related issue: [S28-1](https://github.com/Sevorcer/loop/issues/114)

---

## Purpose

The DB health check runs every day and validates that the LOOP database is in a
known-good state across five areas:

| Area | What is checked |
|---|---|
| **Non-null columns** | `user_profiles.org_id` and `user_profiles.app_role` are never `NULL` |
| **Orphan foreign keys** | `jobs → customers`, `jobs → properties`, `job_activity → jobs`, `portal_memberships → portal_users` |
| **Required indexes** | All critical read/write-path indexes exist in `pg_indexes` |
| **RLS enforcement** | Row Level Security is enabled on every protected table |
| **Migration consistency** | The count of applied migrations in the DB matches the count of files in `supabase/migrations/` |

---

## Where it runs

The job is defined in `.github/workflows/db-health-check.yml` and is
triggered in two ways:

| Trigger | When |
|---|---|
| `schedule` | Daily at **06:00 UTC** |
| `workflow_dispatch` | On demand from the GitHub Actions UI or the CLI |

The JSON report is uploaded as a workflow artifact named
`db-health-report-<run-id>` and retained for **30 days**.

---

## How to run manually

### Via GitHub Actions (recommended)

1. Go to **Actions → Daily DB Health Check** in the repository.
2. Click **Run workflow → Run workflow**.
3. Wait for the run to complete.
4. Download the `db-health-report-*` artifact from the run summary.

### Via the CLI (local or staging)

Prerequisites: `psql` and `jq` must be installed.

```bash
# Set the DB connection string (never commit this)
export LOOP_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"

# Run the script — JSON output to stdout, human summary to stderr
bash scripts/db-health-check.sh

# Optionally save the report to a file
DB_HEALTH_OUTPUT_FILE=/tmp/report.json bash scripts/db-health-check.sh
cat /tmp/report.json | jq .
```

Exit codes:

| Code | Meaning |
|---|---|
| `0` | All checks passed (or no critical failures) |
| `1` | One or more **critical** checks failed |
| `2` | Pre-flight error (missing tool, missing URL, cannot connect) |

---

## Output format

### Human-readable summary (stderr)

```
════════════════════════════════════════════════════════════
 LOOP DB Health Check  —  2026-07-24T06:00:05Z
════════════════════════════════════════════════════════════

1. Required non-null columns — user_profiles
  ✓ Required non-null columns — user_profiles
...
════════════════════════════════════════════════════════════
 ✓ DB Health Check PASSED
 Results: 8 passed, 0 failed, 0 skipped / 8 total
════════════════════════════════════════════════════════════
```

### Machine-readable JSON (stdout)

```json
{
  "run_at": "2026-07-24T06:00:05Z",
  "status": "pass",
  "critical_failures": 0,
  "warning_failures": 0,
  "total_checks": 8,
  "passed_checks": 8,
  "failed_checks": 0,
  "skipped_checks": 0,
  "checks": [
    {
      "id": "null_profile_columns",
      "name": "Required non-null columns — user_profiles",
      "severity": "critical",
      "status": "pass",
      "count": 0,
      "message": "No violations found.",
      "description": "Counts user_profiles rows where org_id or app_role is NULL."
    },
    ...
  ]
}
```

**Possible `status` values per check:**

| Value | Meaning |
|---|---|
| `pass` | `count` is 0 — no violations found |
| `fail` | `count` > 0 — violations exist |
| `skipped` | Query could not run (table missing or DB error) |

The top-level `status` is `"fail"` if `critical_failures > 0`.

---

## Interpreting failures

### `null_profile_columns`

**Symptom**: One or more `user_profiles` rows have `NULL` `org_id` or `app_role`.

**Impact**: These users bypass tenant isolation because the `current_org_id()` and
`current_app_role()` RLS helper functions return `NULL`, causing all policies to
reject their requests silently.

**Action**:
1. Query the affected rows:
   ```sql
   SELECT id, org_id, app_role, created_at
   FROM public.user_profiles
   WHERE org_id IS NULL OR app_role IS NULL;
   ```
2. Identify how they were created (check recent app deployments or manual inserts).
3. Assign the correct `org_id` and `app_role` and verify with the RLS smoke test
   in `scripts/verify-schema.sql`.

---

### `orphan_jobs_customer` / `orphan_jobs_property`

**Symptom**: `jobs` rows reference a `customer_id` or `property_id` that no longer
exists.

**Impact**: Job detail screens return 404 for the linked entity; cascading deletes
may have been bypassed by a direct DB mutation.

**Action**:
1. Identify orphans:
   ```sql
   SELECT j.id, j.job_number, j.customer_id, j.property_id
   FROM public.jobs j
   WHERE (j.customer_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = j.customer_id))
      OR (j.property_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = j.property_id));
   ```
2. Either restore the deleted parent record or nullify the FK column on the job.
3. Open a post-mortem if a significant number of rows are affected.

---

### `orphan_job_activity`

**Symptom**: `job_activity` rows reference a `job_id` that no longer exists.

**Impact**: Activity history is stranded and cannot be displayed.

**Action**: These rows can typically be safely deleted after confirming the job was
intentionally removed.

---

### `orphan_portal_memberships`

**Symptom**: `portal_memberships` rows reference a `portal_user_id` that does not
exist.

**Impact**: Stale memberships may conflict with re-invitations.

**Action**: Delete the orphaned membership rows after confirming the portal_user was
intentionally removed.

---

### `missing_indexes`

**Symptom**: One or more critical indexes are absent from `pg_indexes`.

**Impact**: Queries on `org_id`, `job_id`, or `status` columns fall back to
sequential scans, degrading performance under load.

**Action**:
1. Identify which indexes are missing:
   ```sql
   SELECT index_name
   FROM (VALUES
     ('jobs_org_id_idx'),
     ('jobs_status_idx'),
     ('job_activity_job_id_idx')
     -- ... see scripts/db-health-check.sh for the full list
   ) AS r(index_name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_indexes i
     WHERE i.schemaname = 'public' AND i.indexname = r.index_name
   );
   ```
2. Add a migration that recreates the missing indexes using `CREATE INDEX IF NOT EXISTS`.

---

### `rls_disabled`

**Symptom**: One or more protected tables do not have Row Level Security enabled.

**Impact**: **Critical security issue.** Tenant data isolation is broken for
affected tables — any authenticated session can read all rows regardless of org.

**Action**:
1. Identify affected tables:
   ```sql
   SELECT relname FROM pg_class pc
   JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
   WHERE pc.relkind = 'r' AND pc.rowsecurity = FALSE;
   ```
2. Re-enable RLS immediately:
   ```sql
   ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
   ALTER TABLE <table_name> FORCE  ROW LEVEL SECURITY;
   ```
3. Investigate why RLS was disabled and add a migration to prevent recurrence.
4. Follow the [Auth/Authz Incident Runbook](auth-authz-incidents.md) for security
   escalation steps.

---

### `migration_count`

**Symptom**: The number of applied migrations in `supabase_migrations.schema_migrations`
does not match the count of `*.sql` files in `supabase/migrations/`.

**Impact**: The database schema may be out of sync with the migration history,
signalling either unapplied migrations or out-of-band schema changes.

**Action**:
1. Run `supabase migration list --linked` to see which migrations are pending or
   out-of-order.
2. Apply any pending migrations via `supabase db push --linked`.
3. If migrations were applied out of band, follow the
   [Migration Rollback Runbook](migration-rollback.md).

---

## Adding a new check

1. Add the SQL query in `scripts/db-health-check.sh` following the existing
   `append_check` pattern (see the numbered sections).
2. Add a matching `CheckSpec` entry in `src/lib/dbHealthCheck.ts` with the same
   `id`.
3. Add unit tests in `src/lib/__tests__/db-health-check.test.ts`.
4. Document the failure interpretation in this runbook.

---

## Security notes

- All SQL queries are **read-only** (`SELECT` only).
- The DB connection string is **masked** (`::add-mask::`) in GitHub Actions logs
  before use and is never echoed in plain text.
- No row data is included in the JSON report — only counts.
