-- job_tasks: per-completion stamp (when + who checked the task off).
ALTER TABLE public.job_tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid;
CREATE INDEX IF NOT EXISTS idx_job_tasks_completed_at ON public.job_tasks (completed_at);
COMMENT ON COLUMN public.job_tasks.completed_at IS 'When this checklist item was checked complete (NULL = not completed / legacy row). Uncheck clears to NULL.';
COMMENT ON COLUMN public.job_tasks.completed_by IS 'App-user id (public.users.id / auth uid at write) who checked the item. NULL when unchecked or legacy. No FK: stamped at the repository layer from the signed-in user id.';
