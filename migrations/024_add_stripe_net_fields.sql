ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_net_amount integer;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS merchant_net_amount integer;
