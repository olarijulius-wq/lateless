ALTER TABLE public.workspace_email_settings
  ADD COLUMN IF NOT EXISTS smtp_password_enc text;
