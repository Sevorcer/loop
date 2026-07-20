# LOOP — Database Backup Policy

Version: 1.0  
Last reviewed: 2026-07-20  
Owner: Engineering (on-call lead)

---

## Overview

LOOP uses **Supabase** (PostgreSQL) as its primary data store. This document defines the backup
cadence, retention windows, ownership model, and production-readiness requirements for every
environment tier.

---

## Environment Tiers

| Tier        | Supabase Project            | Sensitivity   |
|-------------|-----------------------------|---------------|
| Development | `loop-dev`                  | Low           |
| Staging     | `loop-staging`              | Medium        |
| Production  | `loop-prod` _(future)_      | High / P0     |

---

## Backup Cadence

### Development

| Type        | Frequency  | Retention | Storage        |
|-------------|------------|-----------|----------------|
| PITR        | Continuous | 7 days    | Supabase-managed |
| Manual dump | On-demand  | 30 days   | Encrypted S3 bucket: `s3://loop-backups-dev/` |

> Point-in-Time Recovery (PITR) is enabled on all Supabase Pro+ plans.  
> Confirm the plan tier in the Supabase dashboard before relying on PITR.

### Staging

| Type        | Frequency   | Retention | Storage        |
|-------------|-------------|-----------|----------------|
| PITR        | Continuous  | 14 days   | Supabase-managed |
| Manual dump | Before every migration | 60 days | `s3://loop-backups-staging/` |
| Automated scheduled | Daily at 02:00 UTC | 30 days | `s3://loop-backups-staging/scheduled/` |

### Production (Policy Draft)

| Type        | Frequency   | Retention | Storage        |
|-------------|-------------|-----------|----------------|
| PITR        | Continuous  | 30 days   | Supabase-managed |
| Automated scheduled | Every 6 hours | 90 days | `s3://loop-backups-prod/` (versioned, cross-region replicated) |
| Pre-migration dump  | Before every migration | 180 days | `s3://loop-backups-prod/migrations/` |
| Monthly archive     | First Sunday of month  | 7 years  | `s3://loop-backups-prod/archive/` (Glacier) |

---

## RTO / RPO Targets

| Tier        | RPO (max data loss) | RTO (max downtime) |
|-------------|---------------------|--------------------|
| Development | 24 hours            | 4 hours            |
| Staging     | 1 hour              | 2 hours            |
| Production  | 15 minutes          | 1 hour             |

These are **targets**. See `docs/drill-report-template.md` and completed reports in `docs/drills/` for observed outcomes from drills.

---

## Backup Ownership

| Responsibility                         | Owner              |
|----------------------------------------|--------------------|
| Verify Supabase PITR is enabled        | Engineering lead   |
| Trigger pre-migration manual dump      | Engineer running migration |
| Monitor scheduled backup success/fail  | On-call engineer   |
| Rotate encryption keys (annually)      | Engineering lead   |
| Quarterly restore drill                | On-call rotation   |
| Policy document review (annual)        | Engineering lead   |

---

## Naming Convention

Manual dumps must follow this naming pattern:

```
{env}_{YYYY-MM-DD}_{HH-MM}_{reason}.sql.gz
# Examples:
staging_2026-07-20_14-30_pre-migration-v3.sql.gz
prod_2026-08-01_02-00_scheduled.sql.gz
```

---

## Encryption

- All backups must be compressed and encrypted with AES-256.
- Use `pg_dump | gzip | openssl enc -aes-256-cbc` or the Supabase dashboard export.
- Encryption keys are stored in the team's secrets manager (not in this repository).
- Keys must be rotated at least annually.

---

## Verification

Every backup (automated or manual) must be verified:

1. Check the backup file is non-zero in size.
2. Run `gunzip --test <file>.sql.gz` to confirm integrity.
3. For pre-migration backups: restore to a throwaway schema and confirm row counts match source.

---

## Compliance

- Backup logs (timestamp, size, checksum, operator) must be retained for 12 months.
- Access to production backups requires MFA and is limited to Engineering lead + on-call.

---

## Related Documents

- [Backup/Restore Runbook](runbooks/backup-restore.md)
- [Migration Rollback Runbook](runbooks/migration-rollback.md)
- [Drill Report Template](drill-report-template.md)
- [Database Overview](database.md)
