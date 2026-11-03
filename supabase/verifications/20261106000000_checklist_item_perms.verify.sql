-- Read-only checks for the B3 job_tasks checklist permission migration.
-- Run after 20261106000000_checklist_item_perms.sql. This file changes nothing.

DO $$
DECLARE
  insert_check text;
  delete_using text;
BEGIN
  -- INSERT: anyone on the internal team may add an item.
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: insert for org staff'
      AND cmd = 'INSERT'
  ), 'insert policy "job_tasks: insert for org staff" must exist';

  SELECT with_check INTO insert_check
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'job_tasks'
    AND policyname = 'job_tasks: insert for org staff';

  ASSERT position('''tech''' IN insert_check) > 0,
    'add path must include tech (anyone in the org can add)';
  ASSERT position('''sales''' IN insert_check) > 0,
    'add path must include sales (anyone in the org can add)';

  -- The office-only insert policy from 20261031100000 must be gone.
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: insert for owner/manager/office'
  ), 'the old office-only insert policy must be replaced';

  -- DELETE: office and above only — not dispatch, not tech.
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: delete for office and above'
      AND cmd = 'DELETE'
  ), 'delete policy "job_tasks: delete for office and above" must exist';

  SELECT qual INTO delete_using
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'job_tasks'
    AND policyname = 'job_tasks: delete for office and above';

  ASSERT position('''office''' IN delete_using) > 0
     AND position('''manager''' IN delete_using) > 0
     AND position('''owner''' IN delete_using) > 0,
    'remove path must allow office, manager, owner';
  ASSERT position('''dispatch''' IN delete_using) = 0,
    'remove path must NOT allow dispatch';
  ASSERT position('''tech''' IN delete_using) = 0,
    'remove path must NOT allow tech';
END $$;
