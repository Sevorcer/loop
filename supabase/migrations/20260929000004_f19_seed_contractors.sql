-- F19: seed the three directory contractors into the real `contractors` table.
-- Idempotent: each row inserts only when no contractor with the same company
-- name exists in the target org. Safe to run multiple times.
--
-- The org is resolved from the owner's profile (collin@legacyoneheating.net).
-- If that lookup ever returns no row, substitute the org id literal below.

WITH target_org AS (
  SELECT org_id
  FROM public.user_profiles
  WHERE id = (SELECT id FROM auth.users WHERE email = 'collin@legacyoneheating.net')
  LIMIT 1
)
INSERT INTO public.contractors (org_id, company_name, contact_name, email, phone, trade, active)
SELECT o.org_id, v.company_name, v.contact_name, v.email, v.phone, v.trade, true
FROM target_org o
CROSS JOIN (VALUES
  ('Arctic Air Solutions', 'James Herrera', 'james@arcticair.com', '206-555-0101', 'HVAC'),
  ('Volt Masters Electric', 'Sandra Kim', 'sandra@voltmasters.com', '206-555-0202', 'Electrical'),
  ('Pacific Plumbing Co.', 'Derek Osei', 'derek@pacificplumbing.com', '206-555-0303', 'Plumbing')
) AS v(company_name, contact_name, email, phone, trade)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.contractors c
  WHERE c.org_id = o.org_id
    AND c.company_name = v.company_name
);
