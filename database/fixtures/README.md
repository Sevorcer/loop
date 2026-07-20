# LOOP deterministic seed fixtures

Datasets:

- `baseline/` — minimum shared records for local + integration use.
- `golden_path/` — realistic cross-domain workflow records layered on baseline.
- `reset/` — deterministic delete statements for seeded records only.

Naming conventions:

- `NN_domain.sql` (`NN` = execution order, two digits).
- Domain files map to operational seed scope:
  - `customers`
  - `properties`
  - `jobs`
  - `dispatch` (persisted as `job_activity` events)
  - `documents_manuals` (persisted as `job_activity` events)

Rules:

- Every record uses a fixed UUID.
- Every upsert uses `ON CONFLICT (id) DO UPDATE`.
- Reset files only delete known seeded IDs and run in dependency-safe order.
