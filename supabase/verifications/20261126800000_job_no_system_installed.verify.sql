-- Verify: 20261126800000_job_no_system_installed
-- Read-only assertions; run after the migration is applied.

DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'jobs'
                   AND column_name = 'no_system_installed'
                   AND data_type = 'boolean' AND is_nullable = 'NO'),
    'jobs.no_system_installed must exist as boolean NOT NULL';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'jobs'
                   AND column_name = 'no_system_installed_by'
                   AND data_type = 'uuid'),
    'jobs.no_system_installed_by must exist as uuid';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'jobs'
                   AND column_name = 'no_system_installed_at'
                   AND data_type = 'timestamp with time zone'),
    'jobs.no_system_installed_at must exist as timestamptz';

  -- Every pre-existing row defaults to "not attested".
  ASSERT NOT EXISTS (SELECT 1 FROM public.jobs WHERE no_system_installed),
    'no job may start out attested';
END $$;

SELECT 'verify 20261126800000 ok' AS result;
