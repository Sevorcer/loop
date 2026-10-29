-- Data seed. The structural requirement is that the contractors directory
-- can receive the seeded rows. Row presence depends on the owner profile
-- existing when the migration ran, so this file does not require those names.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contractors'
      AND column_name = 'company_name'
  ), 'contractors.company_name must exist for the contractor seed';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contractors'
      AND column_name = 'org_id'
  ), 'contractors.org_id must exist for the contractor seed';
END; $$;
