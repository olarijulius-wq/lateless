ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS active_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_active_workspace_id
  ON public.users (active_workspace_id);

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS invoice_footer text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_profiles_workspace_id
  ON public.company_profiles (workspace_id);

UPDATE public.company_profiles cp
SET workspace_id = w.id
FROM public.users u
JOIN public.workspaces w
  ON w.owner_user_id = u.id
WHERE cp.workspace_id IS NULL
  AND lower(cp.user_email) = lower(u.email);

UPDATE public.users u
SET active_workspace_id = membership.workspace_id
FROM (
  SELECT DISTINCT ON (wm.user_id)
    wm.user_id,
    wm.workspace_id
  FROM public.workspace_members wm
  JOIN public.workspaces w
    ON w.id = wm.workspace_id
  ORDER BY wm.user_id, CASE WHEN w.owner_user_id = wm.user_id THEN 0 ELSE 1 END, w.created_at ASC
) AS membership
WHERE u.id = membership.user_id
  AND u.active_workspace_id IS NULL;
