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
    '00000000-0000-4301-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4201-8000-000000000001',
    NULL,
    'dispatch_plan_created',
    'Dispatch plan created',
    'Created baseline dispatch plan for JOB-2001.',
    '2026-07-16T08:30:00Z'
  ),
  (
    '00000000-0000-4301-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4201-8000-000000000002',
    NULL,
    'crew_assigned',
    'Crew assigned',
    'Assigned Tina Brooks crew for baseline service call.',
    '2026-07-16T09:20:00Z'
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
