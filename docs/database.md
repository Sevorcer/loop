# LOOP — Database Overview

Version: 1.0  
Last reviewed: 2026-07-20

---

## Stack

LOOP uses **Supabase** (hosted PostgreSQL) as its primary data store, accessed from Next.js
server components and API routes via the Supabase JS client.

---

## Environment Tiers

| Tier        | Supabase Project       | Connected from                      |
|-------------|------------------------|-------------------------------------|
| Development | `loop-dev`             | `localhost:3000`                    |
| Staging     | `loop-staging`         | Vercel preview / staging deployment |
| Production  | `loop-prod` _(future)_ | Vercel production deployment        |

Connection strings are provided via environment variables (see `DEPLOYMENT.md`):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Schema

Migrations live in `supabase/migrations/` and are applied with the Supabase CLI:

```bash
supabase db push            # apply pending migrations
supabase migration new <name>   # create a new migration file
```

---

## Backup & Recovery

Operational runbooks and policies for backup, restore, and migration rollback:

| Document | Purpose |
|----------|---------|
| [Backup Policy](backup-policy.md) | Cadence, retention, ownership, RTO/RPO targets |
| [Backup/Restore Runbook](runbooks/backup-restore.md) | Step-by-step restore procedure |
| [Migration Rollback Runbook](runbooks/migration-rollback.md) | Rollback procedure for failed migrations |
| [Drill Report Template](drill-report-template.md) | Template for quarterly drill reports |

Completed drill reports are stored in `docs/drills/`.

---

## Related Documents

- [Deployment Guide](../DEPLOYMENT.md)
- [Engineering Standards](engineering-standards.md)
- [Architecture](architecture.md)
- [Database Seeding Runbook](database-seeding.md)
