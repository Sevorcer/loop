-- Asserts job revenue is office-only and calendar groups are shared by the office.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_financials'
  ), 'job_financials must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_financials'
      AND column_name IN ('org_id', 'job_id', 'revenue_cents', 'updated_by')
    HAVING count(*) = 4
  ), 'job_financials must store the org, the job, revenue in cents, and who last changed it';

  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_financials_job_uidx'
  ), 'a job can have only one financials row';

  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'job_financials'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be enabled and forced on job_financials';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance read'
      AND cmd = 'SELECT'
      AND qual ILIKE '%owner%'
      AND qual ILIKE '%manager%'
      AND qual ILIKE '%office%'
      AND qual ILIKE '%current_org_id()%'
  ), 'only owner, manager, and office may read job revenue';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance insert'
      AND cmd = 'INSERT'
  ), 'finance staff must be able to insert job revenue';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance update'
      AND cmd = 'UPDATE'
  ), 'finance staff must be able to update job revenue';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance delete'
      AND cmd = 'DELETE'
  ), 'finance staff must be able to delete job revenue';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance insert'
      AND with_check ILIKE '%dispatch%'
      AND with_check ILIKE '%office%'
  ), 'dispatch can enter a job price, the same as office';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_financials'
      AND policyname = 'job_financials: tech reads assigned'
      AND cmd = 'SELECT'
      AND qual ILIKE '%job_assignees%'
      AND qual ILIKE '%assigned_user_id%'
  ), 'a technician can read the price only on an assigned job';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_financials'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND (
        coalesce(qual, '') ILIKE '%''tech''%'
        OR coalesce(with_check, '') ILIKE '%''tech''%'
      )
  ), 'a technician cannot write a job price';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('job_financials', 'job_financials_history')
      AND (
        coalesce(qual, '') ILIKE '%sales%'
        OR coalesce(with_check, '') ILIKE '%sales%'
        OR coalesce(qual, '') ILIKE '%portal%'
        OR coalesce(with_check, '') ILIKE '%portal%'
      )
  ), 'sales and portal must not be named on job prices';

  ASSERT NOT has_table_privilege('anon', 'public.job_financials', 'SELECT'),
    'anonymous users must not be able to select job financials';

  ASSERT has_table_privilege('authenticated', 'public.job_financials', 'SELECT'),
    'signed-in users need the table grant; row policies still hide revenue';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'calendar_saved_groups'
  ), 'calendar_saved_groups must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'calendar_saved_group_members'
  ), 'calendar_saved_group_members must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'calendar_saved_groups'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be enabled and forced on calendar_saved_groups';

  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'calendar_saved_group_members'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be enabled and forced on calendar_saved_group_members';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_saved_groups'
      AND policyname = 'calendar_saved_groups: office read'
      AND qual ILIKE '%dispatch%'
      AND qual ILIKE '%office%'
      AND qual ILIKE '%current_org_id()%'
  ), 'owner, manager, dispatch, and office may read shared calendar groups';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_saved_groups'
      AND policyname = 'calendar_saved_groups: office delete'
      AND cmd = 'DELETE'
  ), 'office staff must be able to delete a shared calendar group';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_saved_group_members'
      AND policyname = 'calendar_saved_group_members: office insert'
      AND cmd = 'INSERT'
  ), 'office staff must be able to add people to a shared group';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('calendar_saved_groups', 'calendar_saved_group_members')
      AND (
        policyname ILIKE '%tech%'
        OR coalesce(qual, '') ILIKE '%''tech''%'
        OR coalesce(with_check, '') ILIKE '%''tech''%'
      )
  ), 'techs must not have a calendar group policy';

  ASSERT NOT has_table_privilege('anon', 'public.calendar_saved_groups', 'SELECT'),
    'anonymous users must not be able to select calendar groups';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_financials_history'
  ), 'job_financials_history must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'job_financials_history'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be enabled and forced on job_financials_history';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_financials_history'
      AND policyname = 'job_financials_history: finance insert'
      AND with_check ILIKE '%dispatch%'
  ), 'dispatch can record a price change, the same as office';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_financials_history'
      AND (
        coalesce(qual, '') ILIKE '%''tech''%'
        OR coalesce(with_check, '') ILIKE '%''tech''%'
      )
  ), 'technicians must not read price history amounts';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance insert'
      AND with_check ILIKE '%priced_job.org_id%'
  ), 'a new price must reference a job in the same company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_saved_group_members'
      AND policyname = 'calendar_saved_group_members: office insert'
      AND with_check ILIKE '%member_profile.org_id%'
      AND with_check ILIKE '%saved_group.org_id%'
  ), 'a saved group member must belong to the group company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'job_financials_same_company'
  ), 'a price row is rejected when the job is in another company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'calendar_group_member_same_company'
  ), 'a group member is rejected when they are in another company';
END; $$;
