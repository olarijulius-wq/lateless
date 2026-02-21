create table if not exists public.smoke_checks (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  actor_email text not null,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  env jsonb not null,
  payload jsonb not null,
  ok boolean not null default false
);

create index if not exists smoke_checks_workspace_ran_at_desc_idx
  on public.smoke_checks (workspace_id, ran_at desc);

create index if not exists smoke_checks_ran_at_desc_idx
  on public.smoke_checks (ran_at desc);
