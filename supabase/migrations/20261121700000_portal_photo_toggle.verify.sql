-- Verify: portal_photos_visible column on jobs

DO $$
BEGIN
  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'portal_photos_visible'
  )), 'portal_photos_visible column must exist on jobs';

  ASSERT (SELECT column_default = 'false'
    FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'portal_photos_visible'
  ), 'portal_photos_visible must default to false';

  ASSERT (SELECT is_nullable = 'NO'
    FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'portal_photos_visible'
  ), 'portal_photos_visible must be NOT NULL';

  RAISE NOTICE 'portal_photos_visible verification passed';
END $$;
