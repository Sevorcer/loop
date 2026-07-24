# Migration Runbook

This document covers the exact commands used by CI and the equivalent local
developer workflow for managing LOOP's database schema via Supabase migrations.

---

## Prerequisites

Install the Supabase CLI:

```bash
# macOS
brew install supabase/tap/supabase

# npm (cross-platform)
npm install -g supabase

# Verify
supabase --version
```

Log in once:

```bash
supabase login
# Opens browser — paste your Personal Access Token from
# https://app.supabase.com/account/tokens
```

If you are on Windows, run all documented `bash ...` commands from **WSL** or
Git Bash. `cmd.exe`/PowerShell cannot execute these bash scripts directly.

---

## Project setup (one-time per developer)

Link your local workspace to the shared Supabase project:

```bash
supabase link --project-ref <PROJECT_REF>
# You will be prompted for the database password.
```

`<PROJECT_REF>` is the short ID shown in Project Settings → General on
app.supabase.com. It looks like `abcdefghijklmnop`.

---

## Daily development workflow

### 1. Check migration status

Shows which migrations have been applied and which are pending:

```bash
supabase migration list
```

### 2. Apply pending migrations (up)

Applies all local migration files that have not yet been applied to the linked
database:

```bash
supabase db push
```

Equivalent CI step: **Apply migrations (up)**.

### 3. Create a new migration

Always generate a new timestamped file rather than editing an existing one:

```bash
supabase migration new <short_description>
# Example: supabase migration new add_jobs_table
# Creates: supabase/migrations/YYYYMMDDHHMMSS_add_jobs_table.sql
```

Edit the generated file, then apply it:

```bash
supabase db push
```

### 4. Verify migration file structure (offline)

The same script CI runs — no database credentials needed:

```bash
bash scripts/verify-migrations.sh
```

Windows scope/workaround:
- Scope: only commands that call `bash` scripts (for example
  `bash scripts/verify-migrations.sh` and `npm run db:seed|db:reset|db:reseed`)
  require a bash-compatible shell.
- Workaround: run those commands from WSL/Git Bash, or use a Linux/macOS CI
  runner.

This checks:
- Every file follows the naming convention `YYYYMMDDHHMMSS_description.sql`
- No duplicate timestamps
- Files are in ascending timestamp order
- No empty files

### 5. Add the required verification section {#verification-section}

**Every new migration file must include a `-- VERIFICATION:` block** ([issue #118](https://github.com/Sevorcer/loop/issues/118)).  CI will reject
migration PRs that are missing this section.

#### Standard format

Append the following at the end of your migration file:

```sql
-- VERIFICATION: ---------------------------------------------------------------
-- Confirm schema after this migration.  Run each SELECT in the Supabase SQL
-- editor (or via psql) after applying.  Expected result: 1 row per query.

SELECT count(*) = 1 AS table_exists
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = '<your_new_table>';

-- Add one query per significant object created or altered in this migration.
```

Rules:
- The sentinel line must be exactly `-- VERIFICATION:` (at the start of the line).
- At least one `SELECT` statement must follow the sentinel.
- Queries should verify the most critical objects the migration creates or alters
  (tables, columns, RLS enabled, helper functions, etc.).
- Comments and blank lines between queries are encouraged.

#### Validate locally before pushing

Run the same check CI runs — no database credentials needed:

```bash
# Check a specific file:
bash scripts/verify-migration-verification.sh supabase/migrations/YYYYMMDDHHMMSS_your_change.sql

# Check all migration files:
bash scripts/verify-migration-verification.sh
```

#### Pass and fail examples

**✓ PASS** — file contains sentinel and at least one SELECT:

```
Checking 1 migration file(s) for required verification sections

  ✓ 20260801120000_add_widgets_table.sql

Migration verification check PASSED — all 1 file(s) contain a valid verification section.
```

**✗ FAIL** — file is missing the sentinel entirely:

```
Checking 1 migration file(s) for required verification sections

  ✗ 20260801120000_add_widgets_table.sql — missing '-- VERIFICATION:' block
    → Add a verification section at the end of this file.  Example:
    →
    →   -- VERIFICATION: ------------------------------------------------
    →   -- Confirm schema after this migration.  Expected: 1 row each.
    →
    →   SELECT count(*) = 1 AS table_exists
    →   FROM information_schema.tables
    →   WHERE table_schema = 'public'
    →     AND table_name = '<your_new_table>';
    →
    → See docs/migration-runbook.md for the full standard.

Migration verification check FAILED — 1 file(s) missing required verification section.
```

### 6. Check for schema drift

Compares the current database schema against what the migration files describe.
A clean state produces no output:

```bash
supabase db diff
```

If drift is reported, generate a new migration to capture the out-of-band
change:

```bash
supabase db diff --schema public | supabase migration new capture_drift
```

Equivalent CI step: **Check for schema drift**.

---

## Rolling back a migration

Supabase does not support automatic rollback of applied migrations.
To reverse a change:

1. Write a new migration that reverts the schema (e.g. `DROP TABLE`, `ALTER TABLE`).
2. Apply it with `supabase db push`.
3. Commit and push the new file.

> **Never delete or modify an already-applied migration file.** This breaks the
> migration history and will cause CI to fail with an out-of-order error.

---

## Migration file naming convention

```
supabase/migrations/<TIMESTAMP>_<description>.sql
```

| Part | Format | Example |
|------|--------|---------|
| Timestamp | `YYYYMMDDHHMMSS` (UTC) | `20240315143022` |
| Description | lowercase, underscores | `add_jobs_table` |
| Extension | `.sql` | `.sql` |

Full example: `20240315143022_add_jobs_table.sql`

---

## CI workflow

The GitHub Actions workflow at `.github/workflows/db-migrations.yml` runs
automatically on any PR or push to `main` that touches:

- `supabase/migrations/**`
- `supabase/config.toml`
- `scripts/verify-migrations.sh`
- `scripts/verify-migration-verification.sh`

### CI jobs

| Job | Trigger | Description |
|-----|---------|-------------|
| `verify-structure` | All PRs | Runs `scripts/verify-migrations.sh` (naming/order) **and** `scripts/verify-migration-verification.sh` (verification sections) — no secrets required |
| `apply-and-verify` | Non-fork PRs, pushes to main | Applies migrations and checks for drift |

The `Verify migration verification sections` step inside `verify-structure`
detects which migration files were **added or modified** in the PR and checks
only those.  Existing migrations are never retroactively flagged, so
non-migration PRs are completely unaffected.

### Required GitHub secrets

| Secret | Description |
|--------|-------------|
| `SUPABASE_ACCESS_TOKEN` | Personal access token — create at app.supabase.com/account/tokens |
| `SUPABASE_PROJECT_REF` | Project reference ID (Project Settings → General) |
| `SUPABASE_DB_PASSWORD` | Database password (Project Settings → Database) |

Configure these at: `https://github.com/Sevorcer/loop/settings/secrets/actions`

---

## CI failure scenarios

### `verify-structure` fails — naming/order

The migration files themselves are structurally invalid before any database is involved.

Common causes:
- File name does not match `YYYYMMDDHHMMSS_description.sql`
- Duplicate timestamp in two different files
- Files are out of order in the directory
- Empty file (zero bytes)

Fix: rename or reorder files locally and push again.

### `verify-structure` fails — missing verification section

A new or modified migration file does not contain the required `-- VERIFICATION:` block.

Fix: add the verification section (see [step 5 above](#verification-section)) and push again.

Validate locally before pushing:
```bash
bash scripts/verify-migration-verification.sh supabase/migrations/YYYYMMDDHHMMSS_your_change.sql
```

### `apply-and-verify` fails on apply

The migration SQL itself is invalid or conflicts with the existing schema.

Fix: review the failing migration file, correct the SQL, and push again.

### `apply-and-verify` fails on drift check

The database contains schema changes that are not captured in a migration file.

Fix:
```bash
supabase db diff
# Review the diff, then capture it:
supabase db diff --schema public | supabase migration new capture_drift
# Commit and push the new migration file.
```

---

## References

- Supabase CLI docs: https://supabase.com/docs/reference/cli
- Supabase migrations guide: https://supabase.com/docs/guides/database/migrations
- GitHub workflow: `.github/workflows/db-migrations.yml`
- File sequence check: `scripts/verify-migrations.sh`
- Verification section check: `scripts/verify-migration-verification.sh`
- Issues: [#117](https://github.com/Sevorcer/loop/issues/117) (epic), [#118](https://github.com/Sevorcer/loop/issues/118) (standard), [#119](https://github.com/Sevorcer/loop/issues/119) (CI enforcement)
