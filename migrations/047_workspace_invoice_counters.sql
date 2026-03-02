ALTER TABLE public.invoice_counters
  ADD COLUMN IF NOT EXISTS workspace_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_counters_workspace_id_fkey'
      AND conrelid = 'public.invoice_counters'::regclass
  ) THEN
    ALTER TABLE public.invoice_counters
      ADD CONSTRAINT invoice_counters_workspace_id_fkey
      FOREIGN KEY (workspace_id)
      REFERENCES public.workspaces(id)
      ON DELETE CASCADE;
  END IF;
END $$;

WITH invoice_workspace AS (
  SELECT
    lower(i.user_email) AS user_email,
    i.workspace_id,
    max(coalesce(i.updated_at, i.created_at, now())) AS latest_seen_at
  FROM public.invoices i
  WHERE i.workspace_id IS NOT NULL
  GROUP BY lower(i.user_email), i.workspace_id
),
invoice_workspace_ranked AS (
  SELECT
    iw.user_email,
    iw.workspace_id,
    row_number() OVER (
      PARTITION BY iw.user_email
      ORDER BY iw.latest_seen_at DESC, iw.workspace_id
    ) AS rn
  FROM invoice_workspace iw
),
resolved AS (
  SELECT
    ic.user_email,
    coalesce(
      iwr.workspace_id,
      u.active_workspace_id,
      owner_workspace.workspace_id
    ) AS workspace_id
  FROM public.invoice_counters ic
  LEFT JOIN invoice_workspace_ranked iwr
    ON iwr.user_email = lower(ic.user_email)
    AND iwr.rn = 1
  LEFT JOIN public.users u
    ON lower(u.email) = lower(ic.user_email)
  LEFT JOIN LATERAL (
    SELECT wm.workspace_id
    FROM public.workspace_members wm
    WHERE wm.user_id = u.id
      AND wm.role = 'owner'
    ORDER BY wm.created_at ASC, wm.workspace_id ASC
    LIMIT 1
  ) AS owner_workspace
    ON true
  WHERE ic.workspace_id IS NULL
)
UPDATE public.invoice_counters ic
SET workspace_id = resolved.workspace_id
FROM resolved
WHERE ic.user_email = resolved.user_email
  AND resolved.workspace_id IS NOT NULL
  AND ic.workspace_id IS NULL;

WITH workspace_year AS (
  SELECT
    workspace_id,
    max(current_year) AS target_year
  FROM public.invoice_counters
  WHERE workspace_id IS NOT NULL
  GROUP BY workspace_id
),
workspace_state AS (
  SELECT
    wy.workspace_id,
    wy.target_year,
    coalesce(
      max(ic.last_seq) FILTER (WHERE ic.current_year = wy.target_year),
      1
    ) AS target_last_seq
  FROM workspace_year wy
  JOIN public.invoice_counters ic
    ON ic.workspace_id = wy.workspace_id
  GROUP BY wy.workspace_id, wy.target_year
),
keepers AS (
  SELECT DISTINCT ON (ic.workspace_id)
    ic.workspace_id,
    ic.user_email AS keeper_user_email
  FROM public.invoice_counters ic
  WHERE ic.workspace_id IS NOT NULL
  ORDER BY ic.workspace_id, ic.updated_at DESC NULLS LAST, ic.user_email ASC
)
UPDATE public.invoice_counters ic
SET
  current_year = ws.target_year,
  last_seq = ws.target_last_seq,
  updated_at = now()
FROM workspace_state ws
JOIN keepers k
  ON k.workspace_id = ws.workspace_id
WHERE ic.workspace_id = ws.workspace_id
  AND ic.user_email = k.keeper_user_email;

WITH keepers AS (
  SELECT DISTINCT ON (ic.workspace_id)
    ic.workspace_id,
    ic.user_email AS keeper_user_email
  FROM public.invoice_counters ic
  WHERE ic.workspace_id IS NOT NULL
  ORDER BY ic.workspace_id, ic.updated_at DESC NULLS LAST, ic.user_email ASC
)
DELETE FROM public.invoice_counters ic
USING keepers k
WHERE ic.workspace_id = k.workspace_id
  AND ic.user_email <> k.keeper_user_email;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_counters_workspace_id_key'
      AND conrelid = 'public.invoice_counters'::regclass
  ) THEN
    ALTER TABLE public.invoice_counters
      ADD CONSTRAINT invoice_counters_workspace_id_key
      UNIQUE (workspace_id);
  END IF;
END $$;
