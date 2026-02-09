CREATE TABLE IF NOT EXISTS public.workspace_document_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  next_invoice_number integer NOT NULL DEFAULT 1,
  number_padding integer NOT NULL DEFAULT 4,
  footer_note text,
  logo_object_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_files (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('logo')),
  object_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_files_workspace_id
  ON public.workspace_files (workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_files_kind
  ON public.workspace_files (kind);
