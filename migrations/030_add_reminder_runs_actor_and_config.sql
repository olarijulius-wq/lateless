ALTER TABLE IF EXISTS public.reminder_runs
  ADD COLUMN IF NOT EXISTS actor_email text NULL;

ALTER TABLE IF EXISTS public.reminder_runs
  ADD COLUMN IF NOT EXISTS config jsonb NULL;
