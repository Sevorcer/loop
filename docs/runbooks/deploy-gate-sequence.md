# Runbook: Deploy Gate Sequence

Version: 1.0  
Last reviewed: 2026-07-24  
Owner: Engineering on-call  
Related issue: [#120](https://github.com/Sevorcer/loop/issues/120)

---

## Purpose

Enforce a four-stage deploy health sequence so that a deployment can only be
marked **Healthy** after all three gates pass.  A failure at any gate blocks the
healthy signal and preserves the ability to roll back safely.

---

## Sequence (must be exact)

```
Push to main
     │
     ▼
┌─────────────────────────────────┐
│  Gate 1: Apply Migration        │  job: apply-and-verify
│  supabase db push --linked      │
│  + schema drift check           │
└────────────────┬────────────────┘
                 │ pass
                 ▼
┌─────────────────────────────────┐
│  Gate 2: Verification SQL       │  job: verify-sql
│  POST /api/admin/db-health/check│
│  (DB health: RLS, indexes,      │
│   FK integrity, migration count)│
└────────────────┬────────────────┘
                 │ pass
                 ▼
┌─────────────────────────────────┐
│  Gate 3: Application Smoke Test │  job: smoke-test
│  login → create property        │
│         → delete property       │
│  (auth + RLS + schema path)     │
└────────────────┬────────────────┘
                 │ pass
                 ▼
┌─────────────────────────────────┐
│  Mark Deploy Healthy            │  job: mark-healthy
│  (Vercel / branch protection    │
│   can require this status check)│
└─────────────────────────────────┘
```

Any gate failure stops the sequence.  The healthy status is **never emitted**
unless all three gates pass.

---

## Workflow Location

`.github/workflows/db-migrations.yml`

Jobs involved (in order):

| Job | Trigger | Secrets required |
|-----|---------|-----------------|
| `verify-structure` | push + PR | none |
| `apply-and-verify` | push + non-fork PR | `SUPABASE_*` |
| `verify-sql` | push to main only | `LOOP_DEPLOY_URL`, `LOOP_HEALTH_CHECK_TOKEN` |
| `smoke-test` | push to main only | above + `LOOP_SMOKE_USER_*` |
| `mark-healthy` | push to main only | none |

---

## Required Secrets

### Existing (already set)
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `LOOP_DEPLOY_URL`
- `LOOP_HEALTH_CHECK_TOKEN`

### New (must be set for deploy gate to function)
- `LOOP_SMOKE_USER_EMAIL` — email of the smoke test service account
- `LOOP_SMOKE_USER_PASSWORD` — password of the smoke test service account

### Smoke Test Account Setup

The smoke test account must be a real Supabase Auth user with:

1. An entry in `auth.users` (create via Supabase dashboard → Authentication → Users)
2. A corresponding row in `public.user_profiles`:
   ```sql
   INSERT INTO public.user_profiles (id, org_id, app_role)
   VALUES (
     '<smoke-user-uuid>',
     '<org-uuid>',   -- any existing org_id, typically the development org
     'owner'         -- needs insert + delete on properties
   );
   ```
3. No real data associated — this is a service account used only by CI.

---

## Pass / Fail Evidence

### Gate 1: Apply Migration — PASS

```
════════════════════════════════════════════════════
  LOOP DB Drift Gate  v1.0
════════════════════════════════════════════════════
  ✓ Migration file structure is valid.
  ✓ All migrations are applied.
  ✓ No schema drift detected.

  ✓ GATE PASSED — deployment is CLEAR.
```

### Gate 1: Apply Migration — FAIL

```
  ✗ [CRITICAL] Schema drift detected — live DB schema diverges from migration files.
  → Next step: generate a migration for the out-of-band change:
                 supabase db diff --linked --schema public -f <name>
```

**Next action:** See [pre-deploy-gate.md](pre-deploy-gate.md) for remediation.

---

### Gate 2: Verification SQL — PASS

```
## Verification SQL Gate
| Field | Value |
|-------|-------|
| Overall status | pass |
| Critical failures | 0 |
```

### Gate 2: Verification SQL — FAIL

```
::error::[VERIFY-SQL FAILED] 2 critical verification check(s) failed
  Stage      : verify_sql
  Next action: Check /admin/db-health for details. If caused by the migration
               just applied, consider rollback.
```

**Next action:** Open `/admin/db-health` in the deployed app.  Each failing
check has an actionable description.  If the migration introduced the failure,
proceed to [Rollback Decision Points](#rollback-decision-points).

---

### Gate 3: Smoke Test — PASS

```
════════════════════════════════════════════════════
  LOOP Application Smoke Test  v1.0
════════════════════════════════════════════════════
  ✓ login          — Smoke test user authenticated.
  ✓ create_property — Test property created (id: ...).
  ✓ delete_property — Test property cleaned up successfully.

  ✓ SMOKE TEST PASSED — deploy is healthy
```

### Gate 3: Smoke Test — FAIL

```
  ✗ create_property — Property creation failed: new row violates row-level security policy

  ✗ SMOKE TEST FAILED — deploy gate blocked

  Failed stage : create_property
  Next action  :
    INSERT RLS policy on properties may be broken.
    Run: SELECT * FROM pg_policies WHERE tablename='properties' AND cmd='INSERT';
```

**Next action:** If the failure is caused by a migration that altered an RLS
policy, see [Rollback Decision Points](#rollback-decision-points).

---

## Rollback Decision Points

### Should I roll back?

```
Smoke test or verification SQL failed after push to main?
     │
     ├── YES: Was the failure caused by the migration just applied?
     │         ├── YES → Rollback (Path A or B below)
     │         └── NO  → Investigate independently; rollback may not help
     │
     └── NO  → Gate passed; deployment is healthy
```

### Signals that indicate rollback is needed

- Smoke test `create_property` stage fails after a migration that modified the
  `properties` table schema (e.g. added a NOT NULL column).
- Verification SQL gate reports `rls_disabled` or `missing_indexes` that did
  not exist before the migration.
- Gate 1 drift check fails immediately after `apply-and-verify` (indicates
  migration applied but left the DB in an inconsistent state).

### Signals that rollback may NOT help

- Smoke test `login` stage fails — this is an auth infrastructure issue, not
  schema-related.  Check Supabase Auth service health and smoke user credentials.
- Verification SQL fails with `orphan_jobs_*` or `null_profile_columns` — these
  are data integrity issues that preceded the migration.

---

## Rollback Procedure

### Path A — Revert migration (preferred)

Use when the schema change is reversible.

```bash
# 1. Create a revert migration
TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")
touch "supabase/migrations/${TIMESTAMP}_revert_<description>.sql"

# 2. Write the inverse DDL (see migration-rollback.md for table)

# 3. Apply immediately to the linked project
supabase db push --linked

# 4. Verify gates pass
#    Re-run the workflow manually via GitHub Actions → db-migrations.yml → Run workflow
```

For the full revert migration guide, see [migration-rollback.md](migration-rollback.md).

### Path B — Point-in-time restore

Use only when Path A is not safe (destructive migration, data loss).

Follow [backup-restore.md](backup-restore.md) using the **pre-migration backup**.

---

## Orphan Property Cleanup

If the smoke test `delete_property` stage fails, a test property named
`__smoke_<timestamp>__` may remain in the database.  Clean it up manually:

```sql
DELETE FROM public.properties
WHERE name LIKE '__smoke_%__'
  AND primary_system = 'smoke-test';
```

---

## Gate Bypass Policy

The deploy gate must not be bypassed for routine deployments.

Bypass is permitted only for:
1. **P0 incident hotfix** — production is down, code fix is schema-unrelated.
2. **Gate infrastructure failure** — smoke test endpoint or health check endpoint
   is degraded through no fault of the migration.

### How to bypass

Set the `mark-healthy` job as not required in Vercel's deployment protection
(or as a GitHub Actions required check), deploy, then re-enable immediately after.

**Always document the bypass** in the incident report.

---

## Monitoring and Alerting

The `mark-healthy` job in the workflow is the canonical "deploy healthy" signal:
- Appears in GitHub Actions run summary
- Can be required as a GitHub branch protection status check
- Can be required by Vercel deployment protection checks

To require `mark-healthy` as a branch protection check:
**Repository Settings → Branches → main → Require status checks → add "Mark deploy healthy"**

---

## Related Documents

- Gate workflow: `.github/workflows/db-migrations.yml`
- Smoke test script: `scripts/smoke-test.sh`
- Smoke test endpoint: `src/app/api/admin/smoke-test/route.ts`
- Pre-deploy drift gate: [pre-deploy-gate.md](pre-deploy-gate.md)
- Migration rollback: [migration-rollback.md](migration-rollback.md)
- DB health check: [db-health-check.md](db-health-check.md)
- Backup / restore: [backup-restore.md](backup-restore.md)
