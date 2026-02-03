ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS verification_token text,
ADD COLUMN IF NOT EXISTS verification_sent_at timestamptz;
