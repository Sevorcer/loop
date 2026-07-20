INSERT INTO job_activity (
  id,
  org_id,
  job_id,
  actor_id,
  type,
  title,
  description,
  created_at
)
VALUES
  (
    '00000000-0000-4301-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4201-8000-000000000003',
    NULL,
    'dispatch_plan_created',
    'Golden path dispatch plan created',
    'Created deterministic dispatch plan for JOB-3001.',
    '2026-07-20T08:10:00Z'
  ),
  (
    '00000000-0000-4301-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4201-8000-000000000003',
    NULL,
    'crew_dispatched',
    'Golden path crew dispatched',
    'Jordan Lee crew dispatched to Riverstone Condos.',
    '2026-07-20T08:20:00Z'
  )
ON CONFLICT (id) DO UPDATE
SET
  org_id = EXCLUDED.org_id,
  job_id = EXCLUDED.job_id,
  actor_id = EXCLUDED.actor_id,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  created_at = EXCLUDED.created_at;
