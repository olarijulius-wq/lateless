CREATE INDEX IF NOT EXISTS idx_invoices_workspace_due_date_id
  ON public.invoices (workspace_id, due_date, id);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace_status_customer_id_paid_at
  ON public.invoices (workspace_id, status, customer_id, paid_at);
