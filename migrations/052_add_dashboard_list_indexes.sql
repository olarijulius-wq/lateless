CREATE INDEX IF NOT EXISTS idx_invoices_workspace_customer_id
  ON public.invoices (workspace_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_customers_workspace_name_id
  ON public.customers (workspace_id, lower(name), id DESC);

CREATE INDEX IF NOT EXISTS idx_customers_workspace_email_id
  ON public.customers (workspace_id, lower(email), id DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'created_at'
  ) THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_customers_workspace_created_at_desc
        ON public.customers (workspace_id, created_at DESC, id DESC)
    ';
  END IF;
END $$;
