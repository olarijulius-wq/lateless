ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS processing_uplift_amount integer NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payable_amount integer;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS platform_fee_amount integer;

UPDATE public.invoices
SET
  processing_uplift_amount = coalesce(processing_uplift_amount, 0),
  payable_amount = coalesce(payable_amount, amount),
  platform_fee_amount = coalesce(platform_fee_amount, 0)
WHERE
  processing_uplift_amount IS NULL
  OR payable_amount IS NULL
  OR platform_fee_amount IS NULL;

CREATE TABLE IF NOT EXISTS public.workspace_pricing_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  processing_uplift_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
