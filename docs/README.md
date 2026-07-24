# LOOP Documentation Index

## Operations

| Document | Purpose |
|---|---|
| [Auth/Authz Production Incident Runbook](runbooks/auth-authz-incidents.md) | Triage and recovery steps for auth, session, and authorization incidents |
| [Incident Closeout: Auth/RLS Write-Path Authorization Regression](incidents/auth-rls-write-path-closeout.md) | Summary of the Sprint 27 auth/RLS incident, fix, and prevention controls |
| [Backup/Restore Runbook](runbooks/backup-restore.md) | Recovery steps for backup and restore incidents |
| [Migration Rollback Runbook](runbooks/migration-rollback.md) | Rollback procedure for failed database migrations |
| [Pre-Deploy DB Drift Gate](runbooks/pre-deploy-gate.md) | Release flow, gate failure remediation, and bypass policy |
| [DB Drift Detection](runbooks/db-drift-detection.md) | Local run instructions, drift categories, and remediation steps |
| [Daily DB Health Check Runbook](runbooks/db-health-check.md) | Where the check runs, how to run it manually, how to interpret failures |
| [DB Health Dashboard Runbook](runbooks/db-health-dashboard.md) | Dashboard location, alert thresholds, and escalation path for DB health checks |
| [Drill Reports README](drills/README.md) | Location and expectations for completed drill reports |

## Architecture & Reference

- [Auth & Session Architecture](architecture/auth.md)
- [Auth/Authz Observability Baseline](architecture/security/auth-observability.md)
- [RLS Role Matrix](architecture/security/rls-role-matrix.md)
- [Database Overview](database.md)