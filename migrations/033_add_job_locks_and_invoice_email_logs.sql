create table if not exists public.job_locks (
  lock_key text primary key,
  holder text not null,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists job_locks_locked_until_idx
  on public.job_locks (locked_until);

create table if not exists public.invoice_email_logs (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_email text not null,
  to_email text not null,
  provider text not null,
  status text not null,
  sent_at timestamptz null,
  error text null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_email_logs_invoice_created_idx
  on public.invoice_email_logs (invoice_id, created_at desc);

create index if not exists invoice_email_logs_user_created_idx
  on public.invoice_email_logs (lower(user_email), created_at desc);
