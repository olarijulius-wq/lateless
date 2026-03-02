alter table if exists public.refund_requests
  add column if not exists requested_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'refund_requests'
      and column_name = 'created_at'
  ) then
    update public.refund_requests
    set requested_at = created_at
    where requested_at is null;
  else
    update public.refund_requests
    set requested_at = now()
    where requested_at is null;
  end if;
end
$$;

alter table if exists public.refund_requests
  alter column requested_at set default now();

alter table if exists public.refund_requests
  alter column requested_at set not null;

create index if not exists idx_refund_requests_invoice_requested_at_desc
  on public.refund_requests (invoice_id, requested_at desc);
