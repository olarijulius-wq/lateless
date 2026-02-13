CREATE TABLE IF NOT EXISTS public.workspace_reminder_customer_pauses (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  normalized_email text NOT NULL,
  paused_at timestamptz NOT NULL DEFAULT now(),
  paused_by_user_id uuid REFERENCES public.users(id),
  reason text,
  PRIMARY KEY (workspace_id, normalized_email)
);

CREATE INDEX IF NOT EXISTS idx_workspace_reminder_customer_pauses_workspace_id
  ON public.workspace_reminder_customer_pauses (workspace_id);

CREATE TABLE IF NOT EXISTS public.invoice_reminder_pauses (
  invoice_id uuid PRIMARY KEY REFERENCES public.invoices(id) ON DELETE CASCADE,
  paused_at timestamptz NOT NULL DEFAULT now(),
  paused_by_user_id uuid REFERENCES public.users(id),
  reason text
);
