-- Read-only checks for the Service Fusion import follow-up.
-- Run after 20261101193000_sf_import_followups.sql. This file changes nothing.

DO $$ BEGIN
  ASSERT position(
    'request.jwt.claim.role' IN pg_get_functiondef('public.sf_import_apply_batch(jsonb)'::regprocedure)
  ) = 0, 'the importer must not decide access from a token role claim';

  ASSERT position(
    'current_app_role()' IN pg_get_functiondef('public.sf_import_apply_batch(jsonb)'::regprocedure)
  ) > 0, 'the importer must read the role from the profile';

  ASSERT position(
    'customer_links' IN pg_get_functiondef('public.sf_import_apply_batch(jsonb)'::regprocedure)
  ) > 0, 'the importer must be able to adopt an existing customer';

  ASSERT NOT has_function_privilege('anon', 'public.sf_import_apply_batch(jsonb)', 'EXECUTE'),
    'anon must not run the importer';
  ASSERT NOT has_function_privilege('authenticated', 'public.sf_import_apply_batch(jsonb)', 'EXECUTE'),
    'a signed-in user must not run the importer directly';
END $$;
