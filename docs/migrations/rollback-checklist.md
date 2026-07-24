# Migration Rollback Checklist

Version: 1.0  
Last reviewed: 2026-07-24  
Owner: Engineering on-call

Fill this checklist out **before opening a migration PR** and include it in the PR description under the `Rollback Plan` section. Every field is required; write "N/A — [reason]" if a field genuinely does not apply.

---

## 1. Blast Radius

Describe what breaks if this migration causes a problem in production.

| Question | Answer |
|---|---|
| Which tables are affected? | |
| Which API routes or features depend on those tables? | |
| Which user roles / workflows are impacted? | |
| Is this migration additive-only, or does it remove/rename schema? | |
| Estimated number of rows affected (inserts, updates, deletes)? | |

---

## 2. Rollback SQL / Process

Provide the exact SQL (or process) to undo this migration.

```sql
-- ROLLBACK SQL
-- Paste the revert statements here. One statement per forward operation.
-- See the reverse-operation table in docs/runbooks/migration-rollback.md.

```

If the rollback requires a Point-in-Time Restore instead of SQL (e.g. a `DROP TABLE`), state that explicitly and reference the pre-migration backup name:

```
Backup file: {env}_{YYYY-MM-DD}_{HH-MM}_pre-migration-<name>.sql.gz.enc
Restore procedure: docs/runbooks/backup-restore.md
```

---

## 3. Data-Loss Risk

| Risk | Assessment |
|---|---|
| Can any rows be permanently deleted by this migration? | Yes / No |
| Can any columns with existing data be dropped? | Yes / No |
| Does the migration change a column type in a lossy way? | Yes / No |
| Is there a pre-migration backup scheduled / confirmed? | Yes / No — backup name: |
| Is staging validation required before production apply? | Yes / No |

If **any** answer above is "Yes", include a mitigation note:

> **Mitigation:** _Describe what you did to reduce the risk (e.g., renamed instead of dropped, added a default, took manual backup, tested on staging)._

---

## 4. Verification After Rollback

Steps to confirm the system is stable after executing the rollback. Copy-paste and run these in order.

```bash
# 1. Confirm schema is back to the expected state
psql "$SUPABASE_DB_URL" -c "\d+ <affected_table>"

# 2. Check row counts match pre-migration snapshot
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM <affected_table>;"

# 3. Build passes
npm run build 2>&1 | tail -5

# 4. Smoke-test key routes (replace with actual URLs)
curl -sf https://<env>.vercel.app/api/health
```

Then confirm the post-rollback checklist from `docs/runbooks/migration-rollback.md#verification-checklist`:

- [ ] All core tables present and row counts match pre-migration snapshot
- [ ] `npm run build` passes with no TypeScript errors
- [ ] Key routes return 200 (smoke test)
- [ ] No new errors in Vercel / Supabase logs for 15 minutes post-rollback
- [ ] Incident or drill report written and committed to `docs/drills/`

---

## Related Documents

- [Migration Rollback Runbook](../runbooks/migration-rollback.md) — step-by-step rollback execution
- [Backup/Restore Runbook](../runbooks/backup-restore.md) — Point-in-Time Restore procedure
- [Migration Runbook](../migration-runbook.md) — daily developer workflow
- [Backup Policy](../backup-policy.md) — backup cadence and retention
- [Drill Report Template](../drill-report-template.md) — record drill outcomes
