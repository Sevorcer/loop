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
--     call in a public policy is wrapped in a scalar subquery -> (select fn()).
--
--     DEPARSE-AWARE. pg_policies.qual / .with_check are produced by pg_get_expr,
--     which RE-DEPARSES the stored node tree rather than echoing the DDL text.
--     A wrapped call written in the migration as "(select current_app_role())"
--     is deparsed by Postgres as, literally:
--
--         ( SELECT current_app_role() AS current_app_role)
--
--     i.e. a space after "(", an UPPERCASE "SELECT", and the scalar subquery's
--     implicit output-column ALIAS appended (" AS <col>"). The alias is the
--     function's result column name — the UNQUALIFIED function name — so:
--         current_app_role()  -> ( SELECT current_app_role() AS current_app_role)
--         current_org_id()    -> ( SELECT current_org_id()   AS current_org_id)
--         auth.uid()          -> ( SELECT auth.uid()         AS uid)
--     The old check counted the literal lowercase "(select fn())" (0 matches on
--     the deparsed text) against bare "fn()" (every call still contains that
--     substring), so bare<>wrapped always fired even though the wrap is present.
--
--     The matcher below is therefore written against how Postgres ACTUALLY
--     deparses, not against the DDL spelling:
--       1. normalize: lowercase + collapse every whitespace run to one space, so
--          "( SELECT current_app_role() AS current_app_role)" becomes
--          "( select current_app_role() as current_app_role)".
--       2. total   = occurrences of the call token  "fn()".
--          (the appended alias " as current_app_role)" has no "()" and is NOT
--           counted — only genuine call sites with parentheses are.)
--       3. wrapped = occurrences of "select fn()" (a call immediately preceded,
--          ignoring whitespace/case, by the SELECT of its wrapping subquery).
--       4. bare = total - wrapped. A genuinely BARE (non-subquery) call is one
--          that is NOT preceded by SELECT, so bare > 0 <=> an unwrapped call
--          exists -> RAISE. This still catches any regression that drops the
--          wrap, while passing on the current correctly-wrapped live state.
--
--     A read-only SELF-TEST (synthetic deparsed strings, no DDL — honours the
--     read-only verification convention in README.md) is folded into the same
--     loop to PROVE the matcher flags bare calls and passes wrapped ones.
-- ============================================================================
DO $$
DECLARE
  rec record;
  fn text; calltok text; wraptok text; norm text;
  total int; wrapped int; bare int;
BEGIN
  FOR rec IN
    -- real public policies (qual and with_check scanned as separate rows)
    SELECT tablename::text AS tablename, policyname::text AS policyname,
           qual AS expr, false AS synthetic, NULL::boolean AS expect_bare
      FROM pg_policies WHERE schemaname='public'
    UNION ALL
    SELECT tablename::text, policyname::text,
           with_check AS expr, false, NULL::boolean
      FROM pg_policies WHERE schemaname='public'
    UNION ALL
    -- self-test: WRAPPED deparse forms must NOT be flagged (expect_bare=false) ...
    SELECT * FROM (VALUES
      ('__selftest__', 'wrapped_app_role',
         '(( SELECT current_app_role() AS current_app_role) = ''tech''::text)', true, false),
      ('__selftest__', 'wrapped_org_id',
         '(org_id = ( SELECT current_org_id() AS current_org_id))', true, false),
      ('__selftest__', 'wrapped_auth_uid',
         '(user_id = ( SELECT auth.uid() AS uid))', true, false),
      -- ... and BARE forms MUST be flagged (expect_bare=true).
      ('__selftest__', 'bare_app_role',
         '((current_app_role() = ''tech''::text))', true, true),
      ('__selftest__', 'bare_org_id',
         '(org_id = current_org_id())', true, true),
      ('__selftest__', 'bare_auth_uid',
         '(user_id = auth.uid())', true, true)
    ) AS s(tablename, policyname, expr, synthetic, expect_bare)
  LOOP
    FOREACH fn IN ARRAY ARRAY['current_app_role()','current_org_id()','auth.uid()'] LOOP
      norm    := lower(regexp_replace(coalesce(rec.expr,''), '\s+', ' ', 'g'));
      calltok := lower(fn);               -- e.g. "current_app_role()"
      wraptok := 'select ' || lower(fn);  -- e.g. "select current_app_role()"
      total   := (length(norm) - length(replace(norm, calltok, ''))) / length(calltok);
      wrapped := (length(norm) - length(replace(norm, wraptok, ''))) / length(wraptok);
      bare    := total - wrapped;
      IF rec.synthetic THEN
        -- only assert the function the synthetic row actually exercises (total>0)
        IF total > 0 AND (bare > 0) <> rec.expect_bare THEN
          RAISE EXCEPTION 'SECTION (B) SELF-TEST FAILED: matcher for % on row % gave bare=% (total=%, wrapped=%), expected bare-present=%',
            fn, rec.policyname, bare, total, wrapped, rec.expect_bare;
        END IF;
      ELSIF bare > 0 THEN
        RAISE EXCEPTION 'UNWRAPPED % in %.% (bare=%, total=%, wrapped=%): deparsed qual/with_check carries a non-subquery (bare) call',
          fn, rec.tablename, rec.policyname, bare, total, wrapped;
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Initplan rewrite complete: all public-policy auth/org/role calls are wrapped (deparse-aware matcher self-test passed).';
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
