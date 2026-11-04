-- Verification queries for 20261117000000_trigram_indexes_for_name_search.sql
-- Run these after applying the migration to verify it was applied correctly.

-- 1. Verify pg_trgm extension is installed
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_trgm';

-- Expected: one row with extname = 'pg_trgm'

-- 2. Verify all trigram indexes exist with correct properties
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_customers_name_trgm',
    'idx_customers_primary_contact_trgm',
    'idx_customers_street_trgm',
    'idx_customers_city_trgm',
    'idx_properties_name_trgm',
    'idx_properties_address_trgm',
    'idx_properties_city_trgm',
    'idx_properties_primary_system_trgm',
    'idx_organizations_name_trgm'
  )
ORDER BY tablename, indexname;

-- Expected: 9 rows, all using GIN with gin_trgm_ops:
--   idx_customers_city_trgm              | customers     | ... USING gin (city gin_trgm_ops)
--   idx_customers_name_trgm              | customers     | ... USING gin (name gin_trgm_ops)
--   idx_customers_primary_contact_trgm   | customers     | ... USING gin (primary_contact gin_trgm_ops)
--   idx_customers_street_trgm            | customers     | ... USING gin (street gin_trgm_ops)
--   idx_organizations_name_trgm          | organizations | ... USING gin (name gin_trgm_ops)
--   idx_properties_address_trgm          | properties    | ... USING gin (address gin_trgm_ops)
--   idx_properties_city_trgm             | properties    | ... USING gin (city gin_trgm_ops)
--   idx_properties_name_trgm             | properties    | ... USING gin (name gin_trgm_ops)
--   idx_properties_primary_system_trgm   | properties    | ... USING gin (primary_system gin_trgm_ops)

-- 3. Verify total count of trigram indexes (should be exactly 9)
SELECT count(*) AS trigram_index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%_trgm';

-- Expected: 9

-- 4. Verify each index uses the GIN access method
SELECT
  c.relname AS index_name,
  am.amname AS access_method
FROM pg_class c
JOIN pg_am am ON c.relam = am.oid
WHERE c.relname IN (
  'idx_customers_name_trgm',
  'idx_customers_primary_contact_trgm',
  'idx_customers_street_trgm',
  'idx_customers_city_trgm',
  'idx_properties_name_trgm',
  'idx_properties_address_trgm',
  'idx_properties_city_trgm',
  'idx_properties_primary_system_trgm',
  'idx_organizations_name_trgm'
)
ORDER BY c.relname;

-- Expected: 9 rows, all with access_method = 'gin'
