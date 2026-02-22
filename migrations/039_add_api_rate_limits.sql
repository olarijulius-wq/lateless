create table if not exists public.api_rate_limits (
  bucket text not null,
  key text not null,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  primary key (bucket, key)
);

create index if not exists api_rate_limits_window_start_idx
  on public.api_rate_limits (window_start);
