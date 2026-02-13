CREATE TABLE IF NOT EXISTS public.workspace_reminder_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ran_at timestamptz NOT NULL DEFAULT now(),
  triggered_by text NOT NULL CHECK (triggered_by IN ('manual', 'cron', 'dev')),
  dry_run boolean NOT NULL DEFAULT false,
  sent_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  skipped_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_workspace_reminder_runs_workspace_ran_at
  ON public.workspace_reminder_runs (workspace_id, ran_at DESC);
