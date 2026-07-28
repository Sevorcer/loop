-- =============================================================================
-- Verification — 20260728000001_sprint7_feedback_reports
--
-- Asserts that the feedback_reports table and all required columns were created
-- by the Sprint 7 migration.
-- =============================================================================

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
  ), 'feedback_reports table must exist';
END; $$;

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
      AND column_name  = 'severity'
  ), 'feedback_reports.severity column must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'intended_action'
  ), 'feedback_reports.intended_action column must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'actual_result'
  ), 'feedback_reports.actual_result column must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'route_path'
  ), 'feedback_reports.route_path column must exist';
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
      AND column_name  = 'created_by_role'
  ), 'feedback_reports.created_by_role column must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'feedback_reports'
      AND column_name  = 'triage_notes'
  ), 'feedback_reports.triage_notes column must exist';
END; $$;
