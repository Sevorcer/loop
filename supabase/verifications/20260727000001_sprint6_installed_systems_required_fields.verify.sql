-- =============================================================================
-- Verification — 20260727000001_sprint6_installed_systems_required_fields
--
-- Asserts that the manufacturer, model_number, and warranty_expiry columns
-- were added to installed_systems by the Sprint 6 migration.
-- =============================================================================

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'installed_systems'
      AND column_name  = 'manufacturer'
  ), 'installed_systems.manufacturer column must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'installed_systems'
      AND column_name  = 'model_number'
  ), 'installed_systems.model_number column must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'installed_systems'
      AND column_name  = 'warranty_expiry'
  ), 'installed_systems.warranty_expiry column must exist';
END; $$;
