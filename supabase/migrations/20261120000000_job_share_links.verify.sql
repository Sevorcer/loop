-- Verify: job_share_links table and constraints

DO $$
BEGIN
  -- Table exists
  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'job_share_links'
  )), 'job_share_links table must exist';

  -- Required columns
  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_share_links' AND column_name = 'id'
  )), 'id column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_share_links' AND column_name = 'org_id'
  )), 'org_id column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_share_links' AND column_name = 'job_id'
  )), 'job_id column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_share_links' AND column_name = 'token_hash'
  )), 'token_hash column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_share_links' AND column_name = 'created_by'
  )), 'created_by column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_share_links' AND column_name = 'revoked_at'
  )), 'revoked_at column must exist';

  -- Unique index on active links
  ASSERT (SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'uq_job_share_links_active'
  )), 'uq_job_share_links_active index must exist';

  -- Token hash index
  ASSERT (SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_job_share_links_token_hash'
  )), 'idx_job_share_links_token_hash index must exist';

  -- RLS enabled
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE relname = 'job_share_links'),
    'RLS must be enabled on job_share_links';

  RAISE NOTICE 'job_share_links verification passed';
END $$;
