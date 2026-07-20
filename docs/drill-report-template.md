# LOOP — Database Drill Report Template

Version: 1.0  
Last reviewed: 2026-07-20

---

> **Instructions:** Copy this file to `docs/drills/drill-report-YYYY-MM-DD.md` and complete every
> section. Commit the completed report to the repository within 24 hours of the drill.

---

## Drill Metadata

| Field               | Value                        |
|---------------------|------------------------------|
| Date                | YYYY-MM-DD                   |
| Start time (UTC)    | HH:MM                        |
| End time (UTC)      | HH:MM                        |
| Environment         | staging / dev                |
| Drill type          | Restore drill / Rollback drill / Both |
| Facilitator         | @github-handle               |
| Participants        | @handle1, @handle2           |
| Runbook version     | 1.0                          |

---

## Scenario Simulated

_Describe the failure scenario that was rehearsed, e.g.:_
- "Accidental DROP TABLE on `jobs` table"
- "Migration added NOT NULL column without default, breaking inserts"

```
<free text description here>
```

---

## RTO / RPO Targets vs. Observed

| Metric                        | Target       | Observed     | Pass / Fail |
|-------------------------------|--------------|--------------|-------------|
| Recovery Point Objective (RPO)| 1 hour       | _HH:MM_      |             |
| Recovery Time Objective (RTO) | 2 hours      | _HH:MM_      |             |
| Time to detect incident       | —            | _HH:MM_      |             |
| Time to begin restore         | —            | _HH:MM_      |             |
| Time to complete restore      | —            | _HH:MM_      |             |
| Time to verify integrity      | —            | _HH:MM_      |             |

> Targets from [Backup Policy](../backup-policy.md). Update targets if observed outcomes reveal they are unrealistic.

---

## Step-by-Step Log

| Step | Action                          | Operator     | Start (UTC) | End (UTC) | Notes                    |
|------|---------------------------------|--------------|-------------|-----------|--------------------------|
| 1    | Pre-drill backup created        |              | HH:MM       | HH:MM     |                          |
| 2    | Failure scenario applied        |              | HH:MM       | HH:MM     |                          |
| 3    | Incident detected               |              | HH:MM       | —         |                          |
| 4    | Runbook opened                  |              | HH:MM       | —         |                          |
| 5    | Restore / rollback initiated    |              | HH:MM       | HH:MM     |                          |
| 6    | Restore / rollback completed    |              | HH:MM       | —         |                          |
| 7    | Integrity checks run            |              | HH:MM       | HH:MM     |                          |
| 8    | Application verified stable     |              | HH:MM       | —         |                          |

---

## Data Integrity Verification

| Check                              | Expected          | Observed          | Pass / Fail |
|------------------------------------|-------------------|-------------------|-------------|
| Core tables present                | Yes               |                   |             |
| `jobs` row count                   | _N_ (pre-drill)   |                   |             |
| `properties` row count             | _N_ (pre-drill)   |                   |             |
| `customers` row count              | _N_ (pre-drill)   |                   |             |
| Spot record check (known ID)       | Record exists     |                   |             |
| Application build (`npm run build`)| Success           |                   |             |
| Key route smoke test (HTTP 200)    | Pass              |                   |             |

---

## Failure Points & Issues Encountered

_List any steps that failed, were unclear, or took longer than expected._

| # | Step     | Issue description                 | Resolution / Action item       |
|---|----------|-----------------------------------|--------------------------------|
| 1 |          |                                   |                                |
| 2 |          |                                   |                                |

---

## Action Items

| # | Item                             | Owner        | Due date   |
|---|----------------------------------|--------------|------------|
| 1 |                                  |              |            |
| 2 |                                  |              |            |

---

## Overall Outcome

- [ ] **PASS** — All RTO/RPO targets met, integrity verified, application stable
- [ ] **PARTIAL PASS** — Minor issues, action items filed, not blocking
- [ ] **FAIL** — RTO/RPO targets missed or data integrity not confirmed; immediate remediation required

---

## Sign-off

| Role               | Name / Handle | Date       |
|--------------------|---------------|------------|
| Facilitator        |               |            |
| Engineering lead   |               |            |

---

## Escalation Path (Reference)

| Situation                              | Action                                                  |
|----------------------------------------|---------------------------------------------------------|
| Restore needed in **staging/dev**      | On-call engineer proceeds independently                 |
| Restore needed in **production**       | Page Engineering lead → verbal approval → proceed       |
| Recovery exceeding RTO target          | Escalate to Engineering lead + notify stakeholders      |
| Backup file missing or corrupted       | Escalate to Engineering lead; fall back to Supabase PITR|

---

## Related Documents

- [Backup Policy](../backup-policy.md)
- [Backup/Restore Runbook](../runbooks/backup-restore.md)
- [Migration Rollback Runbook](../runbooks/migration-rollback.md)
