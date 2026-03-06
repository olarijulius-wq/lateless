alter table public.users
  add column if not exists created_at timestamptz;

do $$
begin
  if to_regclass('public.nextauth_accounts') is not null then
    update public.users u
    set created_at = coalesce(
      (
        select min(a.created_at)
        from public.nextauth_accounts a
        where a.user_id = u.id
      ),
      u.verification_sent_at,
      u.password_reset_sent_at,
      now()
    )
    where u.created_at is null;
  else
    update public.users
    set created_at = coalesce(
      verification_sent_at,
      password_reset_sent_at,
      now()
    )
    where created_at is null;
  end if;
end $$;

alter table public.users
  alter column created_at set default now();

update public.users
set created_at = now()
where created_at is null;

alter table public.users
  alter column created_at set not null;

create index if not exists idx_users_created_at_desc
  on public.users (created_at desc);
