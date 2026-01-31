-- migrations/003_add_stripe_connect_to_users.sql

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted boolean NOT NULL DEFAULT false;
