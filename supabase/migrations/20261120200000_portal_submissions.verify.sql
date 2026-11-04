-- Verify: portal_submissions table

DO $$
BEGIN
  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'portal_submissions'
  )), 'portal_submissions table must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_submissions' AND column_name = 'id'
  )), 'id column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_submissions' AND column_name = 'job_id'
  )), 'job_id column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_submissions' AND column_name = 'share_link_id'
  )), 'share_link_id column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_submissions' AND column_name = 'name'
  )), 'name column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_submissions' AND column_name = 'message'
  )), 'message column must exist';

  -- RLS enabled
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE relname = 'portal_submissions'),
    'RLS must be enabled on portal_submissions';

  RAISE NOTICE 'portal_submissions verification passed';
END $$;
