# Runbook: Pre-Deploy DB Drift Gate

Version: 1.0  
Last reviewed: 2026-07-24  
Owner: Engineering on-call  
Related issue: [#115](https://github.com/Sevorcer/loop/issues/115)

---

## Purpose

Block deployments to production when critical database drift conditions are
detected, ensuring the running application code is always matched against a
schema it was written to expect.

The gate runs automatically on every push to `main` and every pull request
targeting `main` via `.github/workflows/pre-deploy-gate.yml`.

---

## What the Gate Checks

The gate script (`scripts/db-drift-gate.sh`) runs three sequential checks:

| # | Check | Severity | Blocks deploy? |
|---|-------|----------|----------------|
| 1 | Migration file structure (naming, order, no duplicates) | CRITICAL | Yes |
| 2 | Unapplied migrations (local files not yet applied to DB) | CRITICAL | Yes |
| 3 | Schema drift (`supabase db diff --linked`) | CRITICAL | Yes |

A CRITICAL failure exits the gate with code 1 and fails the GitHub Actions job.
A WARNING exits with code 0 (deploy allowed; advisory output emitted).

---

## Release Flow With Gate

```
Developer opens PR  →  Gate runs on PR  →  Gate passes
                                                  ↓
                              PR is reviewed and approved
                                                  ↓
                              PR merged to main
                                                  ↓
                              Gate runs again on push to main
                                                  ↓
                              Vercel deploy proceeds (gate is required check)
```

To require the gate as a branch protection status check, go to:
**Repository Settings → Branches → main → Require status checks → "DB drift gate"**

---

## Sample Gate Fail Output

```
════════════════════════════════════════════════════
  LOOP DB Drift Gate  v1.0
════════════════════════════════════════════════════
  Script : db-drift-gate.sh
  Started: 2026-07-24T05:30:00Z

── Check 1 — Migration file structure ──────────────────────────────────────
  ✓ Migration file structure is valid.

── Check 2 — Unapplied migrations ──────────────────────────────────────────
  ✓ All migrations are applied.

── Check 3 — Schema drift (db diff) ────────────────────────────────────────
  ✗ [CRITICAL] Schema drift detected — live DB schema diverges from migration files.

── Diff output ─────────────────────────────────────────────────────
alter table "public"."jobs"
  add column "priority" text;
────────────────────────────────────────────────────────────────────

    → Why it matters: the application may behave incorrectly against a drifted schema.
    → Next step     : generate a migration for the out-of-band change:
                        supabase db diff --linked --schema public -f <name>
                      then commit and push the generated file.
    → Ref           : see docs/runbooks/pre-deploy-gate.md for the full release flow.

════════════════════════════════════════════════════
  Gate Summary
════════════════════════════════════════════════════
  Completed: 2026-07-24T05:30:12Z
  Critical failures : 1
  Warnings          : 0

  ✗ GATE FAILED — deployment is BLOCKED.

  Resolve the critical failure(s) listed above before re-deploying.
  See docs/runbooks/pre-deploy-gate.md for the gate bypass policy.
```

---

## Sample Gate Pass Output

```
════════════════════════════════════════════════════
  LOOP DB Drift Gate  v1.0
════════════════════════════════════════════════════
  Script : db-drift-gate.sh
  Started: 2026-07-24T05:30:00Z

── Check 1 — Migration file structure ──────────────────────────────────────
  ✓ Migration file structure is valid.

── Check 2 — Unapplied migrations ──────────────────────────────────────────
  ✓ All migrations are applied.

── Check 3 — Schema drift (db diff) ────────────────────────────────────────
  ✓ No schema drift detected.

════════════════════════════════════════════════════
  Gate Summary
════════════════════════════════════════════════════
  Completed: 2026-07-24T05:30:11Z
  Critical failures : 0
  Warnings          : 0

  ✓ GATE PASSED — deployment is CLEAR.
```

---

## Remediation Guide

### Check 1 failure — Migration file structure

**Symptom:** Migration filenames do not follow `YYYYMMDDHHMMSS_description.sql`, files
are out of timestamp order, or a duplicate timestamp exists.

**Fix:**
```bash
# Inspect the failing files
bash scripts/verify-migrations.sh

# Rename any non-conforming file
mv supabase/migrations/bad_name.sql supabase/migrations/20260724123456_description.sql

# Commit and push
```

---

### Check 2 failure — Unapplied migrations

**Symptom:** Migration files exist locally (or in the PR) that have not been applied to
the target database.

**Fix:**
```bash
# Apply pending migrations
supabase db push --linked

# Verify all are now applied
supabase migration list --linked

# Re-run gate locally (requires SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF)
bash scripts/db-drift-gate.sh
```

---

### Check 3 failure — Schema drift

**Symptom:** `supabase db diff --linked` shows changes in the live database that are not
captured in any migration file (out-of-band DDL changes).

**Fix:**
```bash
# Capture the drift as a new migration
TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")
supabase db diff --linked --schema public -f "${TIMESTAMP}_capture_drift"

# Review the generated file
cat "supabase/migrations/${TIMESTAMP}_capture_drift.sql"

# Commit and push; the gate will re-run and should now pass
git add supabase/migrations/
git commit -m "chore(db): capture out-of-band schema drift"
git push
```

---

## Bypass Policy

**The gate must not be bypassed for routine deployments.**

The gate may be bypassed only in the following circumstances:

1. **P0 incident hotfix** — production is down and a schema-unrelated code fix must ship
   immediately.  Document the bypass in the incident report.
2. **Gate infrastructure failure** — Supabase CLI or project connectivity is degraded and
   the gate cannot complete.  The bypass must be approved by the engineering lead and
   documented in the incident log.

### How to bypass (emergency only)

Add the following to the bottom of the PR description:

```
gate-bypass: true
reason: <one-line reason>
approved-by: @<lead>
```

Then ask a repository admin to merge the PR using the "Merge without waiting for
requirements" option in GitHub branch protection.  **Never disable branch protection
itself.**

---

## Rollback Plan If Gate Misbehaves

If the gate produces false positives or blocks valid deployments:

1. **Identify the false positive** — inspect the gate log in GitHub Actions and
   determine which check is reporting incorrectly.

2. **Quick mitigation** — If the `db-drift-gate.sh` script has a bug, push a fix to
   the script in a separate branch.  Use the bypass policy above for any hotfix that
   cannot wait for the gate fix to be deployed first.

3. **Disable only the affected check** — Do not remove the entire gate. Comment out the
   offending check block in `scripts/db-drift-gate.sh` and push.

4. **Never set the check to `continue-on-error: true`** — this would silently allow
   drifted deployments.  Use the bypass policy instead.

5. **Re-enable the check** once the false positive root cause is fixed and verified.

---

## Reuse by Daily Health Check Job (#114)

`scripts/db-drift-gate.sh` is designed to be called directly from the planned
daily DB health job (issue #114).  No logic duplication is required:

```yaml
# In .github/workflows/db-health-check.yml
- name: Run drift checks
  run: bash scripts/db-drift-gate.sh
```

Issue #114 may add additional checks (orphan FK detection, required index audit,
RLS policy audit) as separate scripts or additional sections in `db-drift-gate.sh`.

---

## References

- Gate script: `scripts/db-drift-gate.sh`
- Gate workflow: `.github/workflows/pre-deploy-gate.yml`
- Migration structure checker: `scripts/verify-migrations.sh`
- Migration rollback runbook: `docs/runbooks/migration-rollback.md`
- Backup/restore runbook: `docs/runbooks/backup-restore.md`
- Daily health check issue: [#114](https://github.com/Sevorcer/loop/issues/114)
