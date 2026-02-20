ALTER TABLE IF EXISTS public.reminder_runs
  ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.reminder_runs
  ADD COLUMN IF NOT EXISTS user_email text NULL;

CREATE INDEX IF NOT EXISTS idx_reminder_runs_workspace_ran_at
  ON public.reminder_runs (workspace_id, ran_at DESC);

CREATE INDEX IF NOT EXISTS idx_reminder_runs_user_email_ran_at
  ON public.reminder_runs (lower(user_email), ran_at DESC);
