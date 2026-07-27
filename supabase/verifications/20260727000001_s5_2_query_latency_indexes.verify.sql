-- =============================================================================
-- Verification — 20260727000001_s5_2_query_latency_indexes
--
-- Asserts that the four composite indexes added for the S5.2 query/latency
-- optimization sprint exist in the database.
-- =============================================================================

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'jobs'
      AND indexname  = 'jobs_org_customer_id_idx'
  ), 'jobs_org_customer_id_idx must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'jobs'
      AND indexname  = 'jobs_org_property_id_idx'
  ), 'jobs_org_property_id_idx must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'customers'
      AND indexname  = 'customers_org_name_idx'
  ), 'customers_org_name_idx must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'properties'
      AND indexname  = 'properties_org_name_idx'
  ), 'properties_org_name_idx must exist';
END; $$;
