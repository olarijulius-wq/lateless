create table if not exists public.schema_migrations (
  id bigserial primary key,
  filename text unique not null,
  applied_at timestamptz not null default now(),
  checksum text null,
  actor_email text null,
  app_version text null
);

create index if not exists schema_migrations_applied_at_idx
  on public.schema_migrations (applied_at desc);
