-- Verify: 20261121400000_manual_auto_match (read-only)
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
   WHERE s.nspname = 'public' AND p.proname = 'record_manual_auto_match' AND p.prosecdef
     AND p.proconfig @> ARRAY['search_path=""'];
  IF n <> 1 THEN RAISE EXCEPTION 'record_manual_auto_match missing, not SECURITY DEFINER, or search_path not pinned'; END IF;

  IF has_function_privilege('anon', 'public.record_manual_auto_match(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute record_manual_auto_match';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.record_manual_auto_match(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute record_manual_auto_match';
  END IF;

  RAISE NOTICE 'manual_auto_match verify OK';
END $$;
