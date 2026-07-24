# DB Health Dashboard — Runbook

**Sprint 28 · Issues #114, #116**

---

## Dashboard Location

- **URL**: `/admin/db-health`
- **Access**: `owner` and `manager` roles only
- **Navigation**: Administration sidebar → DB Health

The dashboard displays:
1. **Status KPIs** — latest run overall status, pass/fail count, critical issues
2. **Run History** — pass/fail trend for the last 7 runs with CI run links
3. **Latest Run Details** — per-check pass/fail breakdown, failure messages, and owner assignments

---

## Alert Routing

Alerts are emitted as structured log events by the `/api/admin/db-health/check` route.

### Log format

```json
[DB_HEALTH_ALERT] {
  "category": "db_health",
  "schemaVersion": "1.0",
  "timestamp": "...",
  "event": "db_health_check_failed",
  "severity": "critical|warning",
  "owner": "on-call|platform-team",
  "runId": "<uuid>",
  "checkName": "...",
  "checkCategory": "schema|integrity|indexes|rls|migrations",
  "message": "...",
  "ciRunUrl": "https://github.com/...",
  "gitSha": "..."
}
```

### Routing table

| Severity | Log level | Route | Owner |
|----------|-----------|-------|-------|
| `critical` | `console.error` | On-call immediately (via log-based alert rule) | `on-call` |
| `warning` | `console.warn` | Team channel / queue | `platform-team` |

**Deduplication**: The in-memory cooldown window is 10 minutes. Repeated alerts for the same `checkName + severity` within the window are silently dropped to avoid alert storms.

**Context links** included in every alert:
- `runId` — UUID of the run; view at `/admin/db-health` and the detail panel
- `ciRunUrl` — Direct link to the GitHub Actions run that triggered the check
- `gitSha` — Git commit SHA at time of check

---

## Check Categories and Thresholds

### `schema` — Required non-null columns (critical)

| Check | Condition | Severity |
|-------|-----------|----------|
| `customers_org_id_not_null` | `customers.org_id IS NOT NULL` for all rows | critical |
| `properties_org_id_not_null` | `properties.org_id IS NOT NULL` for all rows | critical |
| `jobs_org_id_not_null` | `jobs.org_id IS NOT NULL` for all rows | critical |

Failure means data exists that should be impossible given the schema constraints — investigate immediately.

### `integrity` — Orphan foreign keys (warning)

| Check | Condition | Severity |
|-------|-----------|----------|
| `orphan_fk_jobs_customer_id_customers` | No jobs reference deleted customers | warning |
| `orphan_fk_properties_customer_id_customers` | No properties reference deleted customers | warning |
| `orphan_fk_jobs_property_id_properties` | No jobs reference deleted properties | warning |

Orphan rows indicate soft-delete inconsistency. Investigate the data lifecycle.

### `indexes` — Required indexes present (warning)

| Check | Index | Severity |
|-------|-------|----------|
| `index_present_customers_org_id_idx` | `customers(org_id)` | warning |
| `index_present_properties_org_id_idx` | `properties(org_id)` | warning |
| `index_present_jobs_org_id_idx` | `jobs(org_id)` | warning |
| `index_present_user_profiles_org_id_idx` | `user_profiles(id, org_id)` | warning |
| `index_present_db_health_check_runs_run_at_idx` | `db_health_check_runs(run_at)` | warning |
| `index_present_db_health_check_results_run_id_idx` | `db_health_check_results(run_id)` | warning |

Missing indexes degrade query performance but do not break correctness. Schedule re-creation during low-traffic window.

### `rls` — Row-Level Security enabled (critical)

| Check | Condition | Severity |
|-------|-----------|----------|
| `rls_enabled_<table>` | `relrowsecurity = true` in `pg_class` | critical |

RLS disabled on any core table is a security incident. Escalate immediately to the on-call engineer and the security team.

### `migrations` — Migration history consistency (critical)

| Check | Condition | Severity |
|-------|-----------|----------|
| `migration_history_consistency` | Applied count in DB = expected count | critical |

A mismatch means either a migration was applied out-of-band or rolled back without a compensating forward migration. Run `supabase migration list --linked` to diagnose.

---

## Escalation Path

```
CRITICAL failure detected
  └─ [DB_HEALTH_ALERT] console.error fires
      └─ Log-based alert rule triggers on-call page (PagerDuty / Vercel Monitoring)
          └─ On-call engineer investigates within SLA
              └─ If unresolved → escalate to platform team lead
                  └─ If security issue (RLS) → notify security team immediately

WARNING failure detected
  └─ [DB_HEALTH_ALERT] console.warn fires
      └─ Log forwarding routes to team Slack channel #platform-alerts
          └─ Platform team acknowledges and creates a ticket within 24 hours
```

---

## Running the Check Manually

```bash
# Trigger a manual run from the GitHub Actions UI
# → Actions → DB Health Check → Run workflow (select "manual")

# Or via curl (requires LOOP_HEALTH_CHECK_TOKEN):
curl -X POST https://<deploy-url>/api/admin/db-health/check \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"manual","ciRunUrl":null,"gitSha":null}'
```

---

## Required Secrets / Environment Variables

| Name | Where | Purpose |
|------|-------|---------|
| `LOOP_HEALTH_CHECK_TOKEN` | GitHub secrets + Vercel env | ****** for CI trigger auth |
| `LOOP_DEPLOY_URL` | GitHub secrets | Base URL of the deployed app |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env only | Admin Supabase client for DB writes |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `db_health_check_runs` | One row per check execution |
| `db_health_check_results` | One row per individual check within a run |

RLS is enabled on both tables. Service role writes; `owner`/`manager` roles read via the app.

---

## Related

- Issue #113 (Epic) — DB health observability epic
- Issue #114 — Daily DB health check job
- Issue #115 — Pre-deploy DB drift gate
- Issue #116 — DB health dashboard + alert routing
- Docs: `docs/runbooks/db-health-dashboard.md` (this file)
- Observability module: `src/lib/observability/dbHealth.ts`
- GH Actions: `.github/workflows/db-health-check.yml`
