-- migrations/002_login_rate_limit.sql

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success      boolean NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON public.login_attempts (lower(email), attempted_at DESC);