-- Asserts warranty registration columns on installed_systems.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'installed_systems'
      AND column_name = 'warranty_registered' AND data_type = 'boolean' AND is_nullable = 'NO'
  ), 'installed_systems.warranty_registered must be NOT NULL boolean';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'installed_systems'
      AND column_name = 'warranty_registered_at' AND data_type = 'timestamp with time zone'
  ), 'installed_systems.warranty_registered_at must be timestamptz';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'installed_systems'
      AND column_name = 'warranty_registered_by' AND data_type = 'text'
  ), 'installed_systems.warranty_registered_by must be text';
END; $$;
