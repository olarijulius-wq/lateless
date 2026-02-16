ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_processing_fee_amount integer;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_processing_fee_currency text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_balance_transaction_id text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS net_received_amount integer;
