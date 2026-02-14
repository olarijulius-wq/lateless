CREATE TABLE IF NOT EXISTS public.workspace_usage_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN (
      'invoice_created',
      'invoice_updated',
      'reminder_sent',
      'reminder_skipped',
      'reminder_error',
      'unsubscribe',
      'resubscribe',
      'smtp_test_sent'
    )
  ),
  entity_id uuid,
  metadata jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_usage_events_workspace_occurred_at
  ON public.workspace_usage_events (workspace_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_usage_events_workspace_event_occurred_at
  ON public.workspace_usage_events (workspace_id, event_type, occurred_at DESC);
