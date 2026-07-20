# Runbook: Database Backup & Restore

Version: 1.0  
Last reviewed: 2026-07-20  
Owner: Engineering on-call  
Severity scope: P0 / P1 incidents involving data loss or corruption

---

## Purpose

Step-by-step commands for an on-call engineer to:
1. Create a manual point-in-time backup.
2. Restore a Supabase (PostgreSQL) database from backup in a non-production environment.
3. Validate restored data integrity.

This runbook is exercised quarterly via a [restore drill](#restore-drill-procedure).

---

## Prerequisites

| Tool            | Install                              | Notes                                     |
|-----------------|--------------------------------------|-------------------------------------------|
| `psql`          | `brew install libpq` / `apt install postgresql-client` | Client only, no full server needed |
| `pg_dump`       | Bundled with `psql`                  |                                           |
| Supabase CLI    | `npm install -g supabase`            | v1.x                                      |
| AWS CLI         | `brew install awscli`                | For S3 backup storage                     |
| `openssl`       | Pre-installed on macOS/Linux         |                                           |

Ensure the following environment variables are available (never committed to source):

```bash
export SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
export BACKUP_BUCKET="s3://loop-backups-staging"
export BACKUP_KEY_FILE="/path/to/backup.key"     # AES-256 key file
```

---

## 1. Create a Manual Backup

Use before any migration or at the start of an incident.

```bash
# 1. Set a descriptive reason label
REASON="pre-migration-v3"
ENV="staging"
TIMESTAMP=$(date -u +"%Y-%m-%d_%H-%M")
FILENAME="${ENV}_${TIMESTAMP}_${REASON}.sql.gz"

# 2. Dump, compress, encrypt
pg_dump "$SUPABASE_DB_URL" \
  | gzip \
  | openssl enc -aes-256-cbc -pass file:"$BACKUP_KEY_FILE" \
  > "/tmp/${FILENAME}.enc"

# 3. Verify the file is non-zero
ls -lh "/tmp/${FILENAME}.enc"

# 4. Test decompression (without decrypting fully — integrity check)
openssl enc -aes-256-cbc -d -pass file:"$BACKUP_KEY_FILE" \
  < "/tmp/${FILENAME}.enc" \
  | gunzip --test
echo "Backup integrity: OK"

# 5. Upload to S3
aws s3 cp "/tmp/${FILENAME}.enc" "${BACKUP_BUCKET}/${FILENAME}.enc" \
  --storage-class STANDARD_IA

# 6. Log the backup
echo "[$(date -u)] BACKUP OK  env=${ENV}  file=${FILENAME}" >> /var/log/loop-backups.log
```

---

## 2. List Available Backups

```bash
# Supabase PITR snapshots (via dashboard)
# Navigate to: Supabase Dashboard → Project → Database → Backups

# S3 backups
aws s3 ls "${BACKUP_BUCKET}/" --recursive | sort -r | head -20
```

---

## 3. Restore Procedure

> ⚠️ **Never run restore steps against production without explicit approval from the Engineering lead.**  
> See [Escalation Path](#escalation-path).

### 3.1 Restore from Supabase PITR (recommended for staging/dev incidents)

```bash
# 1. In Supabase Dashboard → Database → Backups:
#    - Select the target restore point (timestamp)
#    - Click "Restore" and confirm
#    - Supabase will spin up a new instance — wait for "Restore Complete"

# 2. Update connection string in .env.local (or Vercel env) to point to restored instance
# 3. Run integrity checks (Section 4)
```

**Typical duration:** 5–15 minutes for a staging-scale database.

### 3.2 Restore from S3 Manual Dump

```bash
# 1. Download the chosen backup
BACKUP_FILE="staging_2026-07-20_14-30_pre-migration-v3.sql.gz.enc"
aws s3 cp "${BACKUP_BUCKET}/${BACKUP_FILE}" "/tmp/${BACKUP_FILE}"

# 2. Decrypt and decompress
openssl enc -aes-256-cbc -d -pass file:"$BACKUP_KEY_FILE" \
  < "/tmp/${BACKUP_FILE}" \
  | gunzip > "/tmp/restore.sql"

# 3. Confirm the SQL file looks valid
head -20 /tmp/restore.sql

# 4. Drop and recreate the target schema (STAGING ONLY)
psql "$SUPABASE_DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 5. Restore
psql "$SUPABASE_DB_URL" < /tmp/restore.sql

# 6. Confirm row counts (Section 4)
```

---

## 4. Data Integrity Checks

Run these after every restore to validate correctness.

```bash
psql "$SUPABASE_DB_URL" << 'SQL'
-- Check core tables exist and have rows
SELECT
  table_name,
  (xpath('/row/c/text()',
    query_to_xml('SELECT count(*) AS c FROM ' || table_name, true, false, ''))
  )[1]::text::int AS row_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type  = 'BASE TABLE'
ORDER BY table_name;
SQL
```

Expected: All core tables present (jobs, properties, customers, etc.) with non-zero row counts
matching the pre-restore source. Compare against the snapshot taken before the incident.

```bash
# Spot check: verify a known record exists
psql "$SUPABASE_DB_URL" -c "SELECT id, status FROM jobs LIMIT 5;"
psql "$SUPABASE_DB_URL" -c "SELECT id, address FROM properties LIMIT 5;"
```

---

## 5. Post-Restore Steps

```bash
# 1. Re-run any migrations that occurred AFTER the backup point (if appropriate)
# 2. Update environment variables if the connection string changed
# 3. Restart Next.js / Vercel deployment
#    - In Vercel: Deployments → Redeploy
# 4. Smoke-test key routes
#    curl -s https://staging.loop.app/api/health | jq .
# 5. Notify the team in #incidents Slack channel
# 6. Write a drill report entry (see docs/drill-report-template.md)
```

---

## Restore Drill Procedure

Performed **quarterly** in the `staging` environment.

1. Choose a realistic restore scenario (e.g., simulate accidental table drop).
2. Follow Sections 1–5 above.
3. Record timings for each step.
4. Fill out [Drill Report Template](../drill-report-template.md) and commit to `docs/`.
5. Review RTO/RPO outcomes against targets in [Backup Policy](../backup-policy.md).

---

## Escalation Path

| Situation                                     | Action                                                   |
|-----------------------------------------------|----------------------------------------------------------|
| Restore needed in **staging/dev**             | On-call engineer proceeds independently                  |
| Restore needed in **production**              | Page Engineering lead → get verbal approval → proceed    |
| Unsure which backup to use                    | Escalate to Engineering lead before proceeding           |
| Backup file missing or corrupted              | Escalate to Engineering lead; fall back to Supabase PITR |
| Recovery exceeding RTO target                 | Escalate to Engineering lead + notify stakeholders       |

**On-call contacts:** Maintained in the team's internal directory (not this repository).

---

## Related Documents

- [Backup Policy](../backup-policy.md)
- [Migration Rollback Runbook](migration-rollback.md)
- [Drill Report Template](../drill-report-template.md)
- [Database Overview](../database.md)
