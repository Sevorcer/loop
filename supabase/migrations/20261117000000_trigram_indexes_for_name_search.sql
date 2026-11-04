-- =============================================================================
-- Migration 20261117000000 — Trigram GIN indexes for name / directory search
--
-- The customer and property directory screens search with PostgREST `ilike`
-- across several text columns (see src/repositories/shared.ts →
-- buildIlikeOrFilter).  Without a supporting index, each search triggers a
-- sequential scan on the entire table — acceptable today but a scaling wall
-- once tables grow past a few thousand rows.
--
-- pg_trgm's GIN operator class (`gin_trgm_ops`) accelerates `ILIKE '%term%'`
-- queries by indexing trigrams of the column value.  Postgres can use the
-- index for any `ILIKE` pattern that contains at least one trigram (3+ chars).
--
-- Columns indexed:
--
--   customers.name             — primary directory search
--   customers.primary_contact  — contact name search
--   customers.street           — address search
--   customers.city             — city search
--
--   properties.name            — property name search
--   properties.address         — property address search
--   properties.city            — city search
--   properties.primary_system  — system type search
--
--   organizations.name         — org name lookup
--
-- Indexes are created plain (no CONCURRENTLY) because the database is small
-- and this runs inside the migration transaction via the SQL Editor, matching
-- the pattern from 20261108000000_fk_indexes_and_duplicate_cleanup.sql.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP INDEX IF EXISTS public.idx_customers_name_trgm;
--   DROP INDEX IF EXISTS public.idx_customers_primary_contact_trgm;
--   DROP INDEX IF EXISTS public.idx_customers_street_trgm;
--   DROP INDEX IF EXISTS public.idx_customers_city_trgm;
--   DROP INDEX IF EXISTS public.idx_properties_name_trgm;
--   DROP INDEX IF EXISTS public.idx_properties_address_trgm;
--   DROP INDEX IF EXISTS public.idx_properties_city_trgm;
--   DROP INDEX IF EXISTS public.idx_properties_primary_system_trgm;
--   DROP INDEX IF EXISTS public.idx_organizations_name_trgm;
--   DROP EXTENSION IF EXISTS pg_trgm;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable the pg_trgm extension (available on all Supabase tiers)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 2. Customer directory search indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON public.customers USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_primary_contact_trgm
  ON public.customers USING gin (primary_contact gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_street_trgm
  ON public.customers USING gin (street gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_city_trgm
  ON public.customers USING gin (city gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3. Property directory search indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_properties_name_trgm
  ON public.properties USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_properties_address_trgm
  ON public.properties USING gin (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_properties_city_trgm
  ON public.properties USING gin (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_properties_primary_system_trgm
  ON public.properties USING gin (primary_system gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 4. Organization name search index
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_organizations_name_trgm
  ON public.organizations USING gin (name gin_trgm_ops);
