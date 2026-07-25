# Runbook: Bootstrap Validation

Version: 1.0  
Last reviewed: 2026-07-25  
Owner: Engineering on-call  
Sprint: S2 — Data Integrity & Migration Governance

---

## Purpose

Prove that a newly provisioned LOOP environment is operational — not merely
migrated — by executing an end-to-end validation sequence against a fresh
database.

Bootstrap validation is the canonical answer to:

> "If we spin up a brand-new environment, does everything actually work?"

This runbook covers:
- What the validation sequence checks
- How to run it (locally and in CI)
- How to interpret the output
- How to troubleshoot failures

---

## Validation Sequence

```
Fresh database
    ↓
Stage 1: Pre-flight
    – Tool availability (psql, sha256sum)
    – DATABASE_URL connectivity
    ↓
Stage 2: Migration structure validation
    – Naming convention (YYYYMMDDHHMMSS_description.sql)
    – No duplicate timestamps
    – Ascending timestamp order
    – No empty files
    – Every migration has a companion .verify.sql
    – Every migration has rollback notes (-- DOWN section)
    – Checksum integrity (no in-place edits)
    ↓
Stage 3: Schema verification
    – Required PostgreSQL extensions present
    – Required helper functions present (current_org_id, current_app_role)
    – Core tables exist
    – RLS enabled on all required tables
    – Required indexes present
    ↓
Stage 4: Verification SQL execution
    – Each supabase/verifications/*.verify.sql runs without assertion failures
    ↓
Stage 5: Data bootstrap validation
    – INSERT organization → user_profile → customer → property → job
    – Read back the full chain (JOIN across all tables)
    – Cleanup canary rows (idempotent)
    ↓
PASS — environment is operational
```

Stages 3–5 require a live database connection (DATABASE_URL).  
Stage 2 can run without a database (use `--structure-only`).

---

## Prerequisites

### Tool dependencies

```bash
# PostgreSQL client tools
brew install postgresql      # macOS
apt install postgresql-client # Ubuntu/Debian

# Verify psql is available
psql --version

# sha256sum (included in coreutils on Linux; use gsha256sum on macOS if needed)
sha256sum --version
```

### Environment variable

```bash
export DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"
```

For a Supabase project, use the direct connection string from the Supabase
dashboard → Project Settings → Database → Connection string.

> **Note:** The script uses the `postgres` superuser (or a service_role-equivalent
> user) so that Stage 5 can write and delete canary rows without being blocked
> by RLS.  Application-level users with restricted permissions may fail Stage 5.

---

## Running Locally

### Full validation (all 5 stages — requires DATABASE_URL)

```bash
DATABASE_URL="postgresql://..." bash scripts/db-bootstrap-validate.sh
```

or:

```bash
export DATABASE_URL="postgresql://..."
npm run db:bootstrap-validate
```

### Structure-only (stages 1–2 — no database required)

Use this for a quick pre-PR sanity check without a live database:

```bash
bash scripts/db-bootstrap-validate.sh --structure-only
# or:
npm run db:bootstrap-validate:structure
```

---

## Expected Output

### Successful run

```
════════════════════════════════════════════════════
  LOOP Bootstrap Validation  v1.0
════════════════════════════════════════════════════
  Script      : db-bootstrap-validate.sh
  Mode        : full (requires DATABASE_URL)
  Started     : 2026-07-25T10:00:00Z
  Repo root   : /path/to/loop

── Stage 1: Pre-flight ─────────────────────────────
  ✓ sha256sum available
  ✓ psql available
  ✓ DATABASE_URL is set
  ✓ Database connection successful
  ✓ Stage passed.

── Stage 2: Migration structure validation ─────────────────────────────
Verifying 7 migration file(s) in .../supabase/migrations
  ... [all checks pass] ...
Migration verification PASSED — all checks succeeded.
  ✓ Stage passed.

── Stage 3: Schema verification ─────────────────────────────
  ✓ Extension uuid-ossp present
  ✓ Extension pgcrypto present
  ✓ Helper function current_org_id() present
  ✓ Helper function current_app_role() present
  ✓ Table organizations exists
  ✓ Table user_profiles exists
  ... [all checks pass] ...
  ✓ Stage passed.

── Stage 4: Verification SQL execution ─────────────────────────────
  ✓ 20240101000000_initial_schema.verify.sql — all assertions passed
  ✓ 20260719000001_baseline_core_schema.verify.sql — all assertions passed
  ... [all 7 verification files pass] ...
  ✓ Stage passed.

── Stage 5: Data bootstrap validation ─────────────────────────────
  ✓ Created canary organization (uuid...)
  ✓ Created canary user_profile (uuid...)
  ✓ Created canary customer (uuid...)
  ✓ Created canary property (uuid...)
  ✓ Created canary job (uuid...)
  ✓ Full chain read-back succeeded (org → customer → property → job)
  ✓ Stage passed.

════════════════════════════════════════════════════
  Bootstrap Validation Summary
════════════════════════════════════════════════════
  Completed  : 2026-07-25T10:00:05Z
  Stages     : 5 passed / 5 total

  ✓ BOOTSTRAP VALIDATION PASSED

  The environment is operational:
    • All migrations are structurally valid
    • Schema matches migration contracts
    • Verification SQL assertions all passed
    • Write path (org → customer → property → job) is functional
```

### Failure output (Stage 3 example)

```
── Stage 3: Schema verification ─────────────────────────────
  ✓ Extension uuid-ossp present
  ✓ Extension pgcrypto present
  ✗ Helper function current_org_id() is missing
    → Apply 20260719000001_baseline_core_schema.sql to create it.
  ✗ Stage FAILED.
    → Apply pending migrations:  supabase db push --linked
    → Then re-run this script.
```

Exit code is `1`.

---

## CI Execution

Bootstrap validation (structure-only) runs automatically in the
`DB Schema Verification` GitHub Actions workflow on every push to `main`:

**Workflow:** `.github/workflows/db-verify.yml`  
**Job:** `bootstrap-structure`

The `bootstrap-structure` job requires no database credentials and runs
after `verify-structure` passes.  It is a required gate in the `summary`
job.

Full bootstrap validation (stages 3–5) is not currently automated in CI
because it requires superuser database access.  It should be run manually
before major releases or when provisioning a new environment.

### CI pass/fail conditions

| Condition | Result |
|---|---|
| Migration naming or order invalid | `verify-structure` fails, blocks merge |
| Missing companion `.verify.sql` | `verify-structure` fails, blocks merge |
| Missing rollback notes (`-- DOWN`) | `verify-structure` fails, blocks merge |
| Checksum mismatch | `verify-structure` fails, blocks merge |
| Structure-only bootstrap fails | `bootstrap-structure` fails, advisory |
| Schema drift (live DB) | `verify-schema` fails |
| RLS policy drift (live DB) | `verify-schema` fails |

---

## Troubleshooting

### Stage 1 — Cannot connect to database

```
✗ Cannot connect to database at DATABASE_URL.
```

1. Verify `DATABASE_URL` is set and correctly formatted.
2. Check that the database is reachable from your machine (no firewall blocking port 5432).
3. For Supabase: ensure the project is not paused (free-tier projects pause after inactivity).
4. Try connecting directly: `psql "$DATABASE_URL" -c "SELECT 1"`

### Stage 2 — Migration structure failure

```
✗ 20260799000001_my_migration.sql — missing rollback notes ...
```

1. Add a `-- DOWN` section to the migration file.
2. Run `bash scripts/update-migration-checksums.sh` to update checksums.
3. Commit both the migration and the updated checksum file.

### Stage 3 — Missing table or function

```
✗ Table customers is MISSING
```

1. Check which migration creates the table.
2. Apply pending migrations: `supabase db push --linked`
3. Re-run bootstrap validation.

### Stage 4 — Assertion failure

```
✗ 20260719000001_baseline_core_schema.verify.sql — assertion failed:
    ERROR:  current_org_id() must exist
```

1. Identify the assertion that failed from the error message.
2. Determine if the migration was applied: `supabase migration list --linked`
3. Apply pending migrations or investigate the schema drift.
4. See [DB Drift Detection](db-drift-detection.md) for remediation steps.

### Stage 5 — Write path failure

```
✗ Failed to insert canary customer
```

1. The database connection user may not have INSERT permission.
   - Bootstrap validation requires the `postgres` user or service_role.
   - Application-level (anon/authenticated) users will fail Stage 5 due to RLS.
2. A schema constraint may be violated:
   - Run the INSERT manually in psql to see the full error.
3. RLS is blocking the insert (even for service_role after `FORCE ROW LEVEL SECURITY`):
   - Bootstrap validation can be run with RLS disabled for the canary org only:
     `SET session_replication_role = 'replica';` (use with caution).

---

## Rollback Guidance

Bootstrap validation is read-only except for Stage 5 canary rows.

Stage 5 always cleans up canary rows on exit (including on failure), so the
validation is idempotent.  If the script is killed mid-run (e.g. SIGKILL),
clean up manually:

```sql
-- Find and remove canary rows
DELETE FROM jobs        WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE '__canary_bootstrap_%');
DELETE FROM properties  WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE '__canary_bootstrap_%');
DELETE FROM customers   WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE '__canary_bootstrap_%');
DELETE FROM user_profiles WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE '__canary_bootstrap_%');
DELETE FROM organizations WHERE name LIKE '__canary_bootstrap_%';
```

---

## Related

- [DB Drift Detection](db-drift-detection.md) — drift categories and remediation
- [Migration Rollback Runbook](migration-rollback.md) — rollback procedure
- [Migration Verification Standard](../migration-verification-standard.md) — verification SQL authoring guide
- [Pre-Deploy DB Drift Gate](pre-deploy-gate.md) — deployment gate
