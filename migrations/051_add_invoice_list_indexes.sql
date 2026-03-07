CREATE INDEX IF NOT EXISTS idx_invoices_workspace_created_at_desc
  ON public.invoices (workspace_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace_status_created_at_desc
  ON public.invoices (workspace_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_customers_workspace_id_id
  ON public.customers (workspace_id, id);
