-- Verify: document_storage_id column on job_permits

DO $$
BEGIN
  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_permits' AND column_name = 'document_storage_id'
  )), 'document_storage_id column must exist on job_permits';

  ASSERT (SELECT data_type = 'uuid'
    FROM information_schema.columns
    WHERE table_name = 'job_permits' AND column_name = 'document_storage_id'
  ), 'document_storage_id must be uuid';

  ASSERT (SELECT is_nullable = 'YES'
    FROM information_schema.columns
    WHERE table_name = 'job_permits' AND column_name = 'document_storage_id'
  ), 'document_storage_id must be nullable';

  RAISE NOTICE 'document_storage_id verification passed';
END $$;
