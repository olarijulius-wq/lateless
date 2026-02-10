-- migrations/011_add_feedback.sql

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  page_path text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at_desc
  ON public.feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_user_email_lower
  ON public.feedback (lower(user_email));
