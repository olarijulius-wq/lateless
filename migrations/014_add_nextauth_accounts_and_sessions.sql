CREATE TABLE IF NOT EXISTS public.nextauth_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'oauth',
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nextauth_accounts_provider_provider_account_id
  ON public.nextauth_accounts (provider, provider_account_id);

CREATE INDEX IF NOT EXISTS idx_nextauth_accounts_user_id
  ON public.nextauth_accounts (user_id);

CREATE TABLE IF NOT EXISTS public.nextauth_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nextauth_sessions_user_id
  ON public.nextauth_sessions (user_id);
