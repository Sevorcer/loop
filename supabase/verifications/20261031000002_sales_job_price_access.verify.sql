-- Asserts sales can read and write a price in their own company, and can read
-- the activity the production report needs. Portal and technicians do not
-- gain a write.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance read'
      AND qual ILIKE '%''sales''%'
      AND qual ILIKE '%current_org_id()%'
      AND qual ILIKE '%priced_job.org_id = job_financials.org_id%'
  ), 'sales must read a price only when the job is in the same company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance insert'
      AND with_check ILIKE '%''sales''%'
      AND with_check ILIKE '%current_org_id()%'
      AND with_check ILIKE '%priced_job.org_id = job_financials.org_id%'
  ), 'sales must insert a price only for a job in the same company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance update'
      AND qual ILIKE '%''sales''%'
      AND with_check ILIKE '%''sales''%'
      AND with_check ILIKE '%priced_job.org_id = job_financials.org_id%'
  ), 'sales must update a price only inside their company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance delete'
      AND qual ILIKE '%''sales''%'
      AND qual ILIKE '%current_org_id()%'
  ), 'sales must delete a price only inside their company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_financials_history'
      AND policyname = 'job_financials_history: finance read'
      AND qual ILIKE '%''sales''%'
      AND qual ILIKE '%priced_job.org_id = job_financials_history.org_id%'
  ), 'sales must read price history only for a job in the same company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_financials_history'
      AND policyname = 'job_financials_history: finance insert'
      AND with_check ILIKE '%''sales''%'
      AND with_check ILIKE '%current_org_id()%'
      AND with_check ILIKE '%priced_job.org_id = job_financials_history.org_id%'
  ), 'sales must insert price history only for a job in the same company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_financials'
      AND policyname = 'job_financials: tech reads assigned'
      AND cmd = 'SELECT'
      AND qual ILIKE '%''tech''%'
      AND qual NOT ILIKE '%''sales''%'
  ), 'a technician still reads only an assigned job price';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_financials'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND (
        COALESCE(qual, '') ILIKE '%''tech''%'
        OR COALESCE(with_check, '') ILIKE '%''tech''%'
        OR COALESCE(qual, '') ILIKE '%''portal''%'
        OR COALESCE(with_check, '') ILIKE '%''portal''%'
      )
  ), 'technicians and portal users must not write a job price';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('job_financials', 'job_financials_history')
      AND (
        COALESCE(qual, '') ILIKE '%''portal''%'
        OR COALESCE(with_check, '') ILIKE '%''portal''%'
      )
  ), 'portal users must not read or write job prices';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_activity'
      AND policyname = 'job_activity: sales reads own company'
      AND cmd = 'SELECT'
      AND qual ILIKE '%''sales''%'
      AND qual ILIKE '%current_org_id()%'
  ), 'sales must read job activity in their company so reports have completion dates';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_activity'
      AND policyname = 'job_activity: sales records a price change'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%''sales''%'
      AND with_check ILIKE '%current_org_id()%'
      AND with_check ILIKE '%type = ''price''%'
  ), 'sales may insert only a price timeline row, and only in their company';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_activity'
      AND cmd IN ('UPDATE', 'DELETE')
      AND (
        COALESCE(qual, '') ILIKE '%''sales''%'
        OR COALESCE(with_check, '') ILIKE '%''sales''%'
      )
  ), 'sales must not update or delete the job timeline';
END; $$;
