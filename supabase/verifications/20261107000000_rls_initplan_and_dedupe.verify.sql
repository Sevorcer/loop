-- Verify PR A: RLS initplan wrap + one true-duplicate merge.
-- Run AFTER 20261107000000_rls_initplan_and_dedupe.sql. Read-only; changes nothing.
--
-- This file PROVES two things:
--   (A) The effective access matrix for the hot tables (jobs, job_tasks,
--       dispatch_plans, customers, properties, installed_systems) for the tech,
--       office and dispatch roles across SELECT/INSERT/UPDATE/DELETE is IDENTICAL
--       to the pre-migration behaviour (derived from the live policy dump of
--       2026-11-02). allowed stays allowed, denied stays denied.
--   (B) The initplan rewrite is complete: no public RLS policy still calls
--       current_app_role(), current_org_id() or auth.uid() DIRECTLY (every call is
--       wrapped as (select ...)).
--
-- Access is gated by current_app_role() = '<role>' comparisons inside each policy
-- (all policies target the public/authenticated DB role, not per-app-role DB roles),
-- so a role is permitted an action iff a permissive policy for that action (or ALL)
-- either names that role in its current_app_role predicate or has no current_app_role
-- predicate at all (org-only, role-agnostic). The (select ...) wrapper does not change
-- this: the role literals and the current_app_role token are untouched.

-- ============================================================================
-- (A) EFFECTIVE ACCESS MATRIX — hot tables x {tech,office,dispatch} x CRUD
-- ============================================================================
DO $$
DECLARE
  expected record;
  actual boolean;
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      ('jobs','SELECT','tech',true),
      ('jobs','SELECT','office',true),
      ('jobs','SELECT','dispatch',true),
      ('jobs','INSERT','tech',false),
      ('jobs','INSERT','office',true),
      ('jobs','INSERT','dispatch',true),
      ('jobs','UPDATE','tech',true),
      ('jobs','UPDATE','office',true),
      ('jobs','UPDATE','dispatch',true),
      ('jobs','DELETE','tech',false),
      ('jobs','DELETE','office',false),
      ('jobs','DELETE','dispatch',false),
      ('job_tasks','SELECT','tech',true),
      ('job_tasks','SELECT','office',true),
      ('job_tasks','SELECT','dispatch',true),
      ('job_tasks','INSERT','tech',true),
      ('job_tasks','INSERT','office',true),
      ('job_tasks','INSERT','dispatch',true),
      ('job_tasks','UPDATE','tech',true),
      ('job_tasks','UPDATE','office',true),
      ('job_tasks','UPDATE','dispatch',true),
      ('job_tasks','DELETE','tech',false),
      ('job_tasks','DELETE','office',true),
      ('job_tasks','DELETE','dispatch',false),
      ('dispatch_plans','SELECT','tech',true),
      ('dispatch_plans','SELECT','office',true),
      ('dispatch_plans','SELECT','dispatch',true),
      ('dispatch_plans','INSERT','tech',false),
      ('dispatch_plans','INSERT','office',true),
      ('dispatch_plans','INSERT','dispatch',true),
      ('dispatch_plans','UPDATE','tech',true),
      ('dispatch_plans','UPDATE','office',true),
      ('dispatch_plans','UPDATE','dispatch',true),
      ('dispatch_plans','DELETE','tech',false),
      ('dispatch_plans','DELETE','office',true),
      ('dispatch_plans','DELETE','dispatch',true),
      ('customers','SELECT','tech',false),
      ('customers','SELECT','office',true),
      ('customers','SELECT','dispatch',true),
      ('customers','INSERT','tech',false),
      ('customers','INSERT','office',true),
      ('customers','INSERT','dispatch',false),
      ('customers','UPDATE','tech',false),
      ('customers','UPDATE','office',true),
      ('customers','UPDATE','dispatch',false),
      ('customers','DELETE','tech',false),
      ('customers','DELETE','office',false),
      ('customers','DELETE','dispatch',false),
      ('properties','SELECT','tech',true),
      ('properties','SELECT','office',true),
      ('properties','SELECT','dispatch',true),
      ('properties','INSERT','tech',false),
      ('properties','INSERT','office',true),
      ('properties','INSERT','dispatch',false),
      ('properties','UPDATE','tech',false),
      ('properties','UPDATE','office',true),
      ('properties','UPDATE','dispatch',false),
      ('properties','DELETE','tech',false),
      ('properties','DELETE','office',false),
      ('properties','DELETE','dispatch',false),
      ('installed_systems','SELECT','tech',true),
      ('installed_systems','SELECT','office',true),
      ('installed_systems','SELECT','dispatch',true),
      ('installed_systems','INSERT','tech',true),
      ('installed_systems','INSERT','office',true),
      ('installed_systems','INSERT','dispatch',true),
      ('installed_systems','UPDATE','tech',true),
      ('installed_systems','UPDATE','office',true),
      ('installed_systems','UPDATE','dispatch',true),
      ('installed_systems','DELETE','tech',false),
      ('installed_systems','DELETE','office',true),
      ('installed_systems','DELETE','dispatch',true)
    ) AS m(tbl, act, approle, expect_allow)
  LOOP
    -- A permissive policy admits approle for act when its gate expression
    -- (WITH CHECK for INSERT, else USING/qual) either has no current_app_role
    -- predicate (role-agnostic) or contains the quoted role literal.
    SELECT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = expected.tbl
        AND p.permissive = 'PERMISSIVE'
        AND (p.cmd = expected.act OR p.cmd = 'ALL')
        AND (
          (CASE WHEN expected.act = 'INSERT' THEN p.with_check ELSE p.qual END) IS NOT NULL
          AND (
            (CASE WHEN expected.act = 'INSERT' THEN p.with_check ELSE p.qual END) NOT LIKE '%current_app_role()%'
            OR position('''' || expected.approle || '''' IN (CASE WHEN expected.act = 'INSERT' THEN p.with_check ELSE p.qual END)) > 0
          )
        )
    ) INTO actual;
    IF actual IS DISTINCT FROM expected.expect_allow THEN
      RAISE EXCEPTION 'ACCESS MATRIX DRIFT: % % by role % => got allow=%, expected allow=%',
        expected.tbl, expected.act, expected.approle, actual, expected.expect_allow;
    END IF;
  END LOOP;
  RAISE NOTICE 'Access matrix OK: all hot-table cells match pre-change behaviour.';
END $$;

-- ============================================================================
-- (A') Row-scope + role-exclusion preserved (defends the matrix against a qual
--      rewrite that silently widened or narrowed a scoped policy)
-- ============================================================================
DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs'
    AND policyname='jobs: tech reads own assigned jobs' AND qual LIKE '%assigned_user_id%'),
    'scoped policy jobs: tech reads own assigned jobs lost marker assigned_user_id';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs'
    AND policyname='jobs: tech reads own assigned jobs' AND qual LIKE '%job_assignees%'),
    'scoped policy jobs: tech reads own assigned jobs lost marker job_assignees';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs'
    AND policyname='jobs: tech reads own assigned jobs' AND qual LIKE '%tech%'),
    'scoped policy jobs: tech reads own assigned jobs lost marker tech';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs'
    AND policyname='jobs: tech updates own assigned jobs' AND qual LIKE '%assigned_user_id%'),
    'scoped policy jobs: tech updates own assigned jobs lost marker assigned_user_id';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs'
    AND policyname='jobs: tech updates own assigned jobs' AND qual LIKE '%job_assignees%'),
    'scoped policy jobs: tech updates own assigned jobs lost marker job_assignees';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs'
    AND policyname='jobs: tech updates own assigned jobs' AND qual LIKE '%tech%'),
    'scoped policy jobs: tech updates own assigned jobs lost marker tech';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='properties'
    AND policyname='properties: tech reads properties on assigned jobs' AND qual LIKE '%property_id%'),
    'scoped policy properties: tech reads properties on assigned jobs lost marker property_id';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='properties'
    AND policyname='properties: tech reads properties on assigned jobs' AND qual LIKE '%job_assignees%'),
    'scoped policy properties: tech reads properties on assigned jobs lost marker job_assignees';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='properties'
    AND policyname='properties: tech reads properties on assigned jobs' AND qual LIKE '%tech%'),
    'scoped policy properties: tech reads properties on assigned jobs lost marker tech';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_tasks'
    AND policyname='job_tasks: tech updates tasks on assigned jobs' AND qual LIKE '%caller_is_assigned_to_job%'),
    'scoped policy job_tasks: tech updates tasks on assigned jobs lost marker caller_is_assigned_to_job';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_tasks'
    AND policyname='job_tasks: tech updates tasks on assigned jobs' AND qual LIKE '%tech%'),
    'scoped policy job_tasks: tech updates tasks on assigned jobs lost marker tech';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dispatch_plans'
    AND policyname='dispatch_plans: tech updates assigned job status' AND qual LIKE '%caller_is_assigned_to_job%'),
    'scoped policy dispatch_plans: tech updates assigned job status lost marker caller_is_assigned_to_job';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dispatch_plans'
    AND policyname='dispatch_plans: tech updates assigned job status' AND qual LIKE '%tech%'),
    'scoped policy dispatch_plans: tech updates assigned job status lost marker tech';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='installed_systems'
    AND policyname='installed_systems: tech inserts field equipment' AND with_check LIKE '%caller_is_assigned_to_job%'),
    'scoped policy installed_systems: tech inserts field equipment lost marker caller_is_assigned_to_job';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='installed_systems'
    AND policyname='installed_systems: tech inserts field equipment' AND with_check LIKE '%tech%'),
    'scoped policy installed_systems: tech inserts field equipment lost marker tech';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='installed_systems'
    AND policyname='installed_systems: tech updates field equipment' AND qual LIKE '%caller_is_assigned_to_job%'),
    'scoped policy installed_systems: tech updates field equipment lost marker caller_is_assigned_to_job';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='installed_systems'
    AND policyname='installed_systems: tech updates field equipment' AND qual LIKE '%tech%'),
    'scoped policy installed_systems: tech updates field equipment lost marker tech';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs'
    AND policyname='jobs: read for owner/manager/dispatch/office/sales' AND qual LIKE '%''tech''%'),
    'broad policy jobs: read for owner/manager/dispatch/office/sales must not grant tech';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs'
    AND policyname='jobs: update for owner/manager/dispatch/office' AND qual LIKE '%''tech''%'),
    'broad policy jobs: update for owner/manager/dispatch/office must not grant tech';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='properties'
    AND policyname='properties: read for internal operational roles' AND qual LIKE '%''tech''%'),
    'broad policy properties: read for internal operational roles must not grant tech';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customers'
    AND policyname='customers: read for internal operational roles' AND qual LIKE '%''tech''%'),
    'broad policy customers: read for internal operational roles must not grant tech';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dispatch_plans'
    AND policyname='dispatch_plans: org write' AND qual LIKE '%''tech''%'),
    'broad policy dispatch_plans: org write must not grant tech';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='installed_systems'
    AND policyname='installed_systems: org write' AND qual LIKE '%''tech''%'),
    'broad policy installed_systems: org write must not grant tech';
END $$;

-- ============================================================================
-- (A'') Hot-table policy inventory unchanged (count per table; nothing added/dropped)
-- ============================================================================
DO $$
DECLARE expected record; n int;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('jobs',7),
    ('job_tasks',5),
    ('dispatch_plans',3),
    ('customers',4),
    ('properties',5),
    ('installed_systems',4)
  ) AS e(tbl, cnt) LOOP
    SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND tablename=expected.tbl;
    IF n <> expected.cnt THEN
      RAISE EXCEPTION 'policy count for % changed: got %, expected %', expected.tbl, n, expected.cnt;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- (B) Initplan rewrite complete: every current_app_role()/current_org_id()/auth.uid()
--     call in a public policy is wrapped as (select ...). Proven by: the number of
--     bare `fn()` occurrences equals the number of `(select fn())` occurrences.
-- ============================================================================
DO $$
DECLARE p record; fn text; expr text; bare int; wrapped int;
BEGIN
  FOR p IN SELECT tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname='public' LOOP
    FOREACH fn IN ARRAY ARRAY['current_app_role()','current_org_id()','auth.uid()'] LOOP
      FOREACH expr IN ARRAY ARRAY[coalesce(p.qual,''), coalesce(p.with_check,'')] LOOP
        bare := (length(expr) - length(replace(expr, fn, ''))) / length(fn);
        wrapped := (length(expr) - length(replace(expr, '(select ' || fn || ')', ''))) / length('(select ' || fn || ')');
        IF bare <> wrapped THEN
          RAISE EXCEPTION 'UNWRAPPED % in %.% (bare=%, wrapped=%)', fn, p.tablename, p.policyname, bare, wrapped;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Initplan rewrite complete: all public-policy auth/org/role calls are wrapped.';
END $$;

-- ============================================================================
-- (C) The one true-duplicate merge landed correctly on job_activity
-- ============================================================================
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_activity'
    AND policyname='job_activity: read for owner/manager/dispatch/office/sales' AND cmd='SELECT'),
    'merged job_activity SELECT policy must exist';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_activity'
    AND policyname IN ('job_activity: read for owner/manager/dispatch/office','job_activity: sales reads own company')),
    'the two pre-merge job_activity SELECT policies must be gone';
  -- merged policy preserves the union owner/manager/dispatch/office/sales
  ASSERT (SELECT bool_and(position('''' || r || '''' IN qual) > 0)
          FROM pg_policies, unnest(ARRAY['owner','manager','dispatch','office','sales']) r
          WHERE schemaname='public' AND tablename='job_activity'
            AND policyname='job_activity: read for owner/manager/dispatch/office/sales'),
    'merged job_activity policy must grant the full union of roles';
  -- row-scoped tech policy is untouched and still separate
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_activity'
    AND policyname='job_activity: tech reads own job activity' AND cmd='SELECT'),
    'tech job_activity read policy must remain a separate policy';
END $$;
