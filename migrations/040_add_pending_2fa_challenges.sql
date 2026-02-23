-- migration: 040_add_pending_2fa_challenges.sql
-- Replaces the insecure pending_2fa_password cookie (base64-encoded password
-- stored client-side) with a server-side opaque nonce record. The nonce is
-- stored only in a server-set httpOnly cookie; the user_id is never sent to
-- the client.

create table if not exists public.pending_2fa_challenges (
  nonce         text        not null primary key,
  user_id       uuid        not null references public.users(id) on delete cascade,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

-- Keep the table lean: auto-expire rows via a fast index on expires_at
create index if not exists pending_2fa_challenges_expires_at_idx
  on public.pending_2fa_challenges (expires_at);

-- Convenience: periodic cleanup (called from application code on write)
-- Rows older than 20 minutes are garbage-collected inline.
