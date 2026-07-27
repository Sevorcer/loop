# Runbook: Write-Path Smoke & Load Harness (Sprint S5.1)

Version: 1.0  
Last reviewed: 2026-07-27  
Owner: Engineering

---

## Purpose

Provide repeatable post-deploy confidence checks and baseline performance capture for critical write paths:

- Customer create/update
- Property create/update
- Job create/update/lifecycle transitions
- Dispatch write action (`dispatch-plans` status update when `LOOP_DISPATCH_PLAN_ID` is set)
- Document write action (`/api/documents` when `LOOP_INCLUDE_DOCUMENT_WRITES=true`)

---

## Commands

### Smoke suite (single end-to-end workflow)

```bash
npm run smoke:write-path
```

Dry-run (no live HTTP calls):

```bash
npm run smoke:write-path:dry-run
```

### Load harness (concurrent repeated workflows)

```bash
npm run load:write-path
```

Dry-run:

```bash
npm run load:write-path:dry-run
```

---

## Required and Optional Environment Variables

### Core

- `LOOP_BASE_URL` (required unless `LOOP_DRY_RUN=true`)
- `LOOP_DRY_RUN` (`true|false`, default `false`)
- `LOOP_RESULTS_DIR` (default `/tmp/loop-write-path-harness`)

### Authentication / Authorization seed

Provide at least one option for live runs:

- `LOOP_AUTH_BEARER_TOKEN` (Authorization bearer token)
- `LOOP_AUTH_COOKIE` (raw `Cookie` header for session-auth environments)
- `LOOP_AUTH_ROLE` (`x-loop-role` fallback, non-production environments)

### Dataset and execution shaping

- `LOOP_DATASET_TAG` (default auto-generated run tag)
- `LOOP_DATASET_SIZE` (default `20`)
- `LOOP_REQUEST_TIMEOUT_MS` (default `15000`)

### Load-only

- `LOOP_LOAD_CONCURRENCY` (default `2`)
- `LOOP_LOAD_ITERATIONS` (default `10`)
- `LOOP_LOAD_DURATION_SECONDS` (default `0`, disabled)

### Optional write-path coverage toggles

- `LOOP_DISPATCH_PLAN_ID` (enables dispatch status update write step)
- `LOOP_INCLUDE_DOCUMENT_WRITES` (`true|false`, default `false`)

### Threshold behavior

- `LOOP_ENFORCE_THRESHOLDS` (`true|false`, default `false`)
  - `false`: advisory baseline only (non-blocking)
  - `true`: threshold failures return non-zero exit code

---

## Deterministic Data Strategy

The harness generates deterministic dataset labels:

`<datasetTag>-vu<worker>-it<iteration>-ds<datasetBucket>`

Each workflow:

1. creates customer/property/job test records
2. updates each record
3. runs job lifecycle transitions
4. optionally executes dispatch/document write actions
5. always cleans up created job/property/customer records

This allows repeated runs without cross-run contamination.

---

## Metrics and Output Format

Captured metrics:

- success rate
- error rate
- p50/p95/p99 latency
- throughput (requests/sec and workflows/sec)

Artifacts per run:

- JSON: `<resultsDir>/write-path-smoke-<timestamp>.json` or `<resultsDir>/write-path-load-<timestamp>.json`
- Summary: `<resultsDir>/write-path-smoke-<timestamp>.summary.txt` or `<resultsDir>/write-path-load-<timestamp>.summary.txt`

Threshold baseline source:

- `scripts/perf/write-path-thresholds.json`

---

## Suggested Staging Cadence

- **Smoke**: every staging deploy
- **Load**: at least once per sprint or before high-risk release windows
- Capture and compare artifacts sprint-over-sprint using the same dataset and load settings where possible.

---

## Interpreting Results

- Start with **workflow success/failure** and **error rate**.
- Compare p95/p99 against previous sprint artifacts before reacting to single-run p50 variance.
- Treat threshold failures as advisory until enough baseline history exists; then progressively enforce.

---

## CI Integration

Optional manual workflow:

- `.github/workflows/write-path-harness.yml`
- Trigger: `workflow_dispatch`
- Default mode: dry-run (`dry_run=true`)
- Can optionally run load in same invocation (`run_load=true`)

This workflow is non-blocking by default and not required for every PR.

---

## Known Limitations

- Dispatch write validation requires a valid `LOOP_DISPATCH_PLAN_ID` in target environment.
- Document write validation is optional and may vary by environment policy/data model.
- Load harness currently executes complete workflow loops; it does not yet support per-endpoint weighted traffic profiles.
