-- =============================================================================
-- S5.2 Query & Latency Optimisation — Critical-path composite indexes
--
-- Adds four composite indexes identified as bottlenecks in S5.2 profiling:
--
--   1. jobs(org_id, customer_id)
--      Covers: listJobsByCustomerId, countOpenJobsForCustomer
--      Previously only a single-column jobs(org_id) index existed, causing
--      a partial index scan plus filter on customer_id.
--
--   2. jobs(org_id, property_id)
--      Covers: listJobsByPropertyId, countOpenJobsForProperty
--      Same root cause as #1.
--
--   3. customers(org_id, name)
--      Covers: resolveCustomerIdByName — called on every job write to
--      translate customerName → customer_id.
--
--   4. properties(org_id, name)
--      Covers: resolvePropertyIdByName — called on every job write to
--      translate propertyName → property_id.
--
-- All indexes use IF NOT EXISTS and are non-blocking (no CONCURRENTLY needed
-- for Supabase managed Postgres; safe on staging/prod apply).
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP INDEX IF EXISTS jobs_org_customer_id_idx;
--   DROP INDEX IF EXISTS jobs_org_property_id_idx;
--   DROP INDEX IF EXISTS customers_org_name_idx;
--   DROP INDEX IF EXISTS properties_org_name_idx;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. jobs: composite (org_id, customer_id)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS jobs_org_customer_id_idx
  ON jobs (org_id, customer_id);

-- ---------------------------------------------------------------------------
-- 2. jobs: composite (org_id, property_id)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS jobs_org_property_id_idx
  ON jobs (org_id, property_id);

-- ---------------------------------------------------------------------------
-- 3. customers: composite (org_id, name)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS customers_org_name_idx
  ON customers (org_id, name);

-- ---------------------------------------------------------------------------
-- 4. properties: composite (org_id, name)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS properties_org_name_idx
  ON properties (org_id, name);
