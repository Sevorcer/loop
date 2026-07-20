# Database Seeding Runbook

## Purpose

LOOP uses deterministic fixture-backed seed data so local development, integration tests, and high-level workflow tests run against stable records.

This seed system is operational-readiness only and does not introduce user-facing features.

## Commands

From repository root:

```bash
npm run db:seed
npm run db:reset
npm run db:reseed
```

### Optional flags

```bash
npm run db:seed -- --dataset baseline
npm run db:seed -- --dataset golden_path
npm run db:seed -- --dry-run
```

Same flags are supported by `db:reset` and `db:reseed`.

## Required environment variables

One of:

- `LOOP_DB_URL`
- `SUPABASE_DB_URL`
- `DATABASE_URL`

`db:reset` is destructive for fixture records and is blocked in production contexts unless:

```bash
LOOP_DB_ALLOW_PROD_RESET=true
```

`db:seed` is blocked in production `NODE_ENV/APP_ENV/LOOP_ENV=production` unless:

```bash
LOOP_DB_ALLOW_PROD_SEED=true
```

## Fixture structure

```
database/fixtures/
  baseline/
    00_organizations.sql
    10_customers.sql
    20_properties.sql
    30_jobs.sql
    40_dispatch.sql
    50_documents_manuals.sql
  golden_path/
    10_customers.sql
    20_properties.sql
    30_jobs.sql
    40_dispatch.sql
    50_documents_manuals.sql
  reset/
    10_golden_path.sql
    20_baseline.sql
```

### Domain mapping

- `customers` → `customers` table
- `properties` → `properties` table
- `jobs` → `jobs` table
- `dispatch` → `job_activity` (dispatch events)
- `documents_manuals` → `job_activity` (document/manual events)

### Naming conventions

- `NN_domain.sql` where `NN` controls deterministic execution order.
- Stable UUIDs are hardcoded; no random generation.
- Inserts are idempotent via `ON CONFLICT (id) DO UPDATE`.

## Baseline vs golden path datasets

- **baseline**: minimal shared records for local development and integration setup.
- **golden_path**: realistic workflow records layered on top of baseline.

Default `db:seed` applies both in order: baseline then golden_path.

## Supabase CLI integration

`supabase/config.toml` is configured to load these fixture SQL files during `supabase db reset`, using the same deterministic order as the scripts above.

## Adding a new domain fixture

1. Add a new `NN_domain.sql` file under `baseline/` and/or `golden_path/`.
2. Use deterministic IDs and explicit timestamps.
3. Use `ON CONFLICT (id) DO UPDATE` for idempotency.
4. If records should be removable by `db:reset`, add their IDs to the relevant file in `database/fixtures/reset/`.
5. Keep referential order safe (children before parents in reset).
6. Run `npm run test`, `npm run lint`, and `npm run build`.

## CI usage

Typical CI prep step:

```bash
npm ci
npm run db:reseed
npm run test
```

Use a non-production database URL for CI.

## Troubleshooting

### `Missing database URL`
Set `LOOP_DB_URL`, `SUPABASE_DB_URL`, or `DATABASE_URL`.

### `psql is required`
Install PostgreSQL client tools so `psql` is available on PATH.

### Production safety error
Switch to a non-production DB context. Only use override flags intentionally.

### FK constraint failures during reset/seed
Run full reseed:

```bash
npm run db:reseed
```

If custom records depend on seeded IDs, remove dependent rows first.
