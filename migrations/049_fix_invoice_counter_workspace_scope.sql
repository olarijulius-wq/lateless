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
    max(coalesce(i.updated_at, i.issued_at, now())) AS latest_seen_at
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
WHERE lower(ic.user_email) = lower(resolved.user_email)
  AND resolved.workspace_id IS NOT NULL
  AND ic.workspace_id IS NULL;

ALTER TABLE public.invoice_counters
  DROP CONSTRAINT IF EXISTS invoice_counters_pkey;

WITH current_tallinn_year AS (
  SELECT extract(year FROM now() AT TIME ZONE 'Europe/Tallinn')::integer AS current_year
),
workspace_seeds AS (
  SELECT DISTINCT i.workspace_id
  FROM public.invoices i
  WHERE i.workspace_id IS NOT NULL
),
latest_invoice_actor AS (
  SELECT DISTINCT ON (i.workspace_id)
    i.workspace_id,
    lower(i.user_email) AS user_email
  FROM public.invoices i
  WHERE i.workspace_id IS NOT NULL
    AND nullif(trim(i.user_email), '') IS NOT NULL
  ORDER BY i.workspace_id, coalesce(i.updated_at, i.issued_at, now()) DESC, i.id DESC
),
owner_actor AS (
  SELECT DISTINCT ON (wm.workspace_id)
    wm.workspace_id,
    lower(u.email) AS owner_email
  FROM public.workspace_members wm
  JOIN public.users u
    ON u.id = wm.user_id
  WHERE wm.role = 'owner'
  ORDER BY wm.workspace_id, wm.created_at ASC, u.email ASC
)
INSERT INTO public.invoice_counters (workspace_id, user_email, current_year, last_seq, updated_at)
SELECT
  ws.workspace_id,
  coalesce(
    lia.user_email,
    oa.owner_email,
    'workspace-' || ws.workspace_id::text || '@local.invalid'
  ) AS user_email,
  cty.current_year,
  1,
  now()
FROM workspace_seeds ws
CROSS JOIN current_tallinn_year cty
LEFT JOIN latest_invoice_actor lia
  ON lia.workspace_id = ws.workspace_id
LEFT JOIN owner_actor oa
  ON oa.workspace_id = ws.workspace_id
LEFT JOIN public.invoice_counters ic
  ON ic.workspace_id = ws.workspace_id
WHERE ic.workspace_id IS NULL;

WITH keepers AS (
  SELECT DISTINCT ON (ic.workspace_id)
    ic.workspace_id,
    ic.user_email AS keeper_user_email
  FROM public.invoice_counters ic
  WHERE ic.workspace_id IS NOT NULL
  ORDER BY ic.workspace_id, ic.updated_at DESC NULLS LAST, ic.user_email ASC
),
workspace_year AS (
  SELECT
    ic.workspace_id,
    max(ic.current_year) AS target_year
  FROM public.invoice_counters ic
  WHERE ic.workspace_id IS NOT NULL
  GROUP BY ic.workspace_id
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

WITH parsed_invoice_numbers AS (
  SELECT
    i.workspace_id,
    split_part(i.invoice_number, '-', 2)::integer AS invoice_year,
    split_part(i.invoice_number, '-', 3)::integer AS invoice_seq
  FROM public.invoices i
  WHERE i.workspace_id IS NOT NULL
    AND i.invoice_number ~ '^INV-[0-9]{4}-[0-9]+$'
),
workspace_parsed_max_year AS (
  SELECT
    pin.workspace_id,
    max(pin.invoice_year) AS parsed_max_year
  FROM parsed_invoice_numbers pin
  GROUP BY pin.workspace_id
),
counter_targets AS (
  SELECT
    ic.workspace_id,
    greatest(ic.current_year, coalesce(wpmy.parsed_max_year, ic.current_year)) AS target_year,
    ic.current_year AS previous_year,
    ic.last_seq AS previous_last_seq
  FROM public.invoice_counters ic
  LEFT JOIN workspace_parsed_max_year wpmy
    ON wpmy.workspace_id = ic.workspace_id
  WHERE ic.workspace_id IS NOT NULL
),
workspace_target_state AS (
  SELECT
    ct.workspace_id,
    ct.target_year,
    greatest(
      CASE WHEN ct.previous_year = ct.target_year THEN ct.previous_last_seq ELSE 0 END,
      coalesce(max(pin.invoice_seq), 0),
      1
    ) AS target_last_seq
  FROM counter_targets ct
  LEFT JOIN parsed_invoice_numbers pin
    ON pin.workspace_id = ct.workspace_id
    AND pin.invoice_year = ct.target_year
  GROUP BY ct.workspace_id, ct.target_year, ct.previous_year, ct.previous_last_seq
)
UPDATE public.invoice_counters ic
SET
  current_year = wts.target_year,
  last_seq = wts.target_last_seq,
  updated_at = now()
FROM workspace_target_state wts
WHERE ic.workspace_id = wts.workspace_id;

WITH duplicate_candidates AS (
  SELECT
    i.id,
    i.workspace_id,
    coalesce(i.updated_at, i.issued_at, now()) AS sort_ts,
    row_number() OVER (
      PARTITION BY i.workspace_id, i.invoice_number
      ORDER BY coalesce(i.updated_at, i.issued_at, now()) ASC, i.id ASC
    ) AS duplicate_rank
  FROM public.invoices i
  WHERE i.workspace_id IS NOT NULL
    AND i.invoice_number IS NOT NULL
),
duplicate_rows AS (
  SELECT
    dc.id,
    dc.workspace_id,
    dc.sort_ts,
    row_number() OVER (
      PARTITION BY dc.workspace_id
      ORDER BY dc.sort_ts ASC, dc.id ASC
    ) AS workspace_row
  FROM duplicate_candidates dc
  WHERE dc.duplicate_rank > 1
),
rewrites AS (
  SELECT
    dr.id,
    dr.workspace_id,
    ic.last_seq + dr.workspace_row AS next_seq,
    ('INV-' || ic.current_year::text || '-' || lpad((ic.last_seq + dr.workspace_row)::text, 4, '0')) AS next_invoice_number
  FROM duplicate_rows dr
  JOIN public.invoice_counters ic
    ON ic.workspace_id = dr.workspace_id
),
updated_invoices AS (
  UPDATE public.invoices i
  SET invoice_number = rewrites.next_invoice_number,
      updated_at = now()
  FROM rewrites
  WHERE i.id = rewrites.id
  RETURNING rewrites.workspace_id, rewrites.next_seq
),
workspace_offsets AS (
  SELECT
    ui.workspace_id,
    count(*)::integer AS allocated_count
  FROM updated_invoices ui
  GROUP BY ui.workspace_id
)
UPDATE public.invoice_counters ic
SET
  last_seq = ic.last_seq + wo.allocated_count,
  updated_at = now()
FROM workspace_offsets wo
WHERE ic.workspace_id = wo.workspace_id;

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_workspace_invoice_number_unique
  ON public.invoices (workspace_id, invoice_number)
  WHERE workspace_id IS NOT NULL
    AND invoice_number IS NOT NULL;
