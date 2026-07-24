# Runbook: Migration Rollback

Version: 1.0  
Last reviewed: 2026-07-20  
Owner: Engineering on-call  
Severity scope: P0 / P1 incidents caused by a failed or breaking database migration

---

## Purpose

Step-by-step procedure for an on-call engineer to:
1. Detect that a migration has caused a problem.
2. Halt forward progress and assess impact.
3. Execute a rollback via revert migration or database restore.
4. Verify system stability after rollback.

---

## Prerequisites

- Pre-migration backup exists (created per [Backup Policy](../backup-policy.md) Section "Pre-migration dump").
- Access to the migration files in the repository.
- `psql` and `supabase` CLI installed (see [Backup/Restore Runbook](backup-restore.md#prerequisites)).

```bash
export SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
```

---

## Decision Tree

```
Migration applied?
  └── YES → Application errors / data anomalies observed?
              ├── YES → Can a revert migration fix it cleanly?
              │           ├── YES → Path A: Revert Migration
              │           └── NO  → Path B: Point-in-Time Restore
              └── NO  → Monitor for 15 min; if stable, close incident
```

---

## Path A — Revert Migration (preferred)

Use when the schema change is reversible and no data has been lost.

### A.1 Write a revert migration

```bash
# In the repository
TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")
touch "supabase/migrations/${TIMESTAMP}_revert_<description>.sql"
```

The revert migration must undo every DDL statement in the failed migration:

| Forward operation         | Revert operation                  |
|---------------------------|-----------------------------------|
| `ALTER TABLE ADD COLUMN`  | `ALTER TABLE DROP COLUMN`         |
| `ALTER TABLE DROP COLUMN` | `ALTER TABLE ADD COLUMN ...`      |
| `CREATE TABLE`            | `DROP TABLE IF EXISTS`            |
| `DROP TABLE`              | Restore from backup (Path B)      |
| `CREATE INDEX`            | `DROP INDEX IF EXISTS`            |
| `ADD CONSTRAINT`          | `ALTER TABLE DROP CONSTRAINT`     |
| `RENAME COLUMN`           | `ALTER TABLE RENAME COLUMN` back  |

### A.2 Apply the revert migration

```bash
# Review the revert SQL first
cat supabase/migrations/${TIMESTAMP}_revert_<description>.sql

# Apply against staging
psql "$SUPABASE_DB_URL" -f supabase/migrations/${TIMESTAMP}_revert_<description>.sql

# Confirm no errors
echo "Exit code: $?"
```

### A.3 Verify application stability

```bash
# Run integration spot checks
psql "$SUPABASE_DB_URL" -c "\d+ <affected_table>"

# Confirm the app starts and key queries succeed
npm run build 2>&1 | tail -5
```

---

## Path B — Point-in-Time Restore

Use when:
- A `DROP TABLE` or destructive migration cannot be cleanly reverted.
- Data loss is confirmed.
- Path A is not safe.

Follow the full **[Backup/Restore Runbook](backup-restore.md)** Sections 1–5.

Key difference: use the **pre-migration backup** taken immediately before the failed migration.

```bash
# The pre-migration backup should be named:
# {env}_{YYYY-MM-DD}_{HH-MM}_pre-migration-<name>.sql.gz.enc
# Example:
BACKUP_FILE="staging_2026-07-20_14-30_pre-migration-v3.sql.gz.enc"
```

After restore:
1. Do **not** re-apply the failed migration.
2. Fix the migration SQL in a new file.
3. Get the fix reviewed before re-applying.

---

## Rollback Drill Procedure

Performed **quarterly** alongside the restore drill (or separately at the team's discretion).

### Drill scenario

1. Apply a purposefully breaking migration to the staging environment:
   ```sql
   -- Drill migration: add a NOT NULL column without a default
   ALTER TABLE jobs ADD COLUMN drill_field TEXT NOT NULL;
   ```
2. Confirm the application errors (e.g., insert fails).
3. Execute Path A rollback:
   ```sql
   ALTER TABLE jobs DROP COLUMN IF EXISTS drill_field;
   ```
4. Confirm the application recovers.
5. Record timings and outcomes in [Drill Report Template](../drill-report-template.md).

---

## Verification Checklist

After any rollback, confirm:

- [ ] All core tables present and row counts match pre-migration snapshot
- [ ] Application builds without TypeScript errors (`npm run build`)
- [ ] Key routes return 200 (smoke test)
- [ ] No new errors in Vercel / Supabase logs in the 15 minutes following rollback
- [ ] Drill report or incident report written and committed

---

## Escalation Path

| Situation                                     | Action                                                   |
|-----------------------------------------------|----------------------------------------------------------|
| Rollback in **staging/dev**                   | On-call engineer proceeds independently                  |
| Rollback in **production**                    | Page Engineering lead → verbal approval → proceed        |
| Cannot determine correct revert SQL           | Escalate to original migration author before proceeding  |
| Data loss confirmed, backups missing          | Engineering lead + immediate stakeholder notification    |
| Recovery exceeding RTO target                 | Escalate to Engineering lead + notify stakeholders       |

---

## Related Documents

- [Rollback Planning Checklist](../migrations/rollback-checklist.md) — fill this out before every migration PR
- [Backup Policy](../backup-policy.md)
- [Backup/Restore Runbook](backup-restore.md)
- [Drill Report Template](../drill-report-template.md)
- [Database Overview](../database.md)
