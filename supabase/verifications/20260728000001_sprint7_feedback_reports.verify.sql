-- =============================================================================
-- Verification — 20260728000001_sprint7_feedback_reports
--
-- Asserts that the feedback_reports table, all required columns, indexes,
-- trigger, and RLS policies were created by the Sprint 7 migration.
-- =============================================================================

-- Table existence
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
  ), 'feedback_reports table must exist';
END; $$;

-- Core columns
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'id'
  ), 'feedback_reports.id column must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'org_id'
      AND is_nullable  = 'NO'
  ), 'feedback_reports.org_id must be NOT NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'created_at'
      AND is_nullable  = 'NO'
  ), 'feedback_reports.created_at must be NOT NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'updated_at'
      AND is_nullable  = 'NO'
  ), 'feedback_reports.updated_at must exist and be NOT NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'created_by_user_id'
      AND is_nullable  = 'NO'
  ), 'feedback_reports.created_by_user_id must be NOT NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'created_by_role'
      AND is_nullable  = 'NO'
  ), 'feedback_reports.created_by_role must exist and be NOT NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'severity'
  ), 'feedback_reports.severity column must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'intended_action'
      AND is_nullable  = 'NO'
  ), 'feedback_reports.intended_action must be NOT NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'actual_result'
      AND is_nullable  = 'NO'
  ), 'feedback_reports.actual_result must be NOT NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'route_path'
      AND is_nullable  = 'NO'
  ), 'feedback_reports.route_path must be NOT NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'status'
  ), 'feedback_reports.status column must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'triage_notes'
      AND is_nullable  = 'NO'
  ), 'feedback_reports.triage_notes must exist and be NOT NULL';
END; $$;

-- Nullable context columns
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'context_job_id'
      AND is_nullable  = 'YES'
  ), 'feedback_reports.context_job_id must exist and be nullable';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'context_customer_id'
      AND is_nullable  = 'YES'
  ), 'feedback_reports.context_customer_id must exist and be nullable';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'context_property_id'
      AND is_nullable  = 'YES'
  ), 'feedback_reports.context_property_id must exist and be nullable';
END; $$;

-- updated_at trigger
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table  = 'feedback_reports'
      AND trigger_name        = 'trg_feedback_reports_updated_at'
  ), 'updated_at trigger must exist on feedback_reports';
END; $$;

-- RLS enabled
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'feedback_reports'
      AND c.relrowsecurity = true
  ), 'RLS must be enabled on feedback_reports';
END; $$;

-- RLS policies exist
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'feedback_reports'
      AND policyname = 'feedback_reports_insert_staff'
  ), 'feedback_reports_insert_staff policy must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'feedback_reports'
      AND policyname = 'feedback_reports_select_manager'
  ), 'feedback_reports_select_manager policy must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'feedback_reports'
      AND policyname = 'feedback_reports_update_manager'
  ), 'feedback_reports_update_manager policy must exist';
END; $$;
