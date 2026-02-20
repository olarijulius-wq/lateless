alter table public.invoices
  add column if not exists created_at timestamptz;

update public.invoices
set created_at = coalesce(issued_at, updated_at, now())
where created_at is null;

alter table public.invoices
  alter column created_at set default now();

create index if not exists idx_invoices_user_email_created_at
  on public.invoices (lower(user_email), created_at);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'workspace_id'
  ) then
    execute 'create index if not exists idx_invoices_workspace_created_at on public.invoices (workspace_id, created_at)';
  end if;
end
$$;
