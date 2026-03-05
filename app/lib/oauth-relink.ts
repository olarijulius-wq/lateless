import { sql } from '@/app/lib/db';

type RelinkOAuthAccountInput = {
  provider: string;
  providerAccountId: string;
  email: string;
  resolvedName: string;
  type?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  tokenType?: string | null;
  scope?: string | null;
  idToken?: string | null;
  sessionState?: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function relinkOAuthAccountForExistingUser(
  input: RelinkOAuthAccountInput,
): Promise<{ ok: boolean; userId?: string }> {
  const normalizedEmail = normalizeEmail(input.email);
  const [existing] = await sql<{ id: string }[]>`
    select id
    from users
    where lower(trim(email)) = ${normalizedEmail}
    limit 1
  `;

  if (!existing?.id) {
    return { ok: false };
  }

  await sql`
    update users
    set
      name = case
        when coalesce(trim(name), '') = '' then ${input.resolvedName}
        else name
      end,
      is_verified = true,
      verification_token = null,
      verification_sent_at = null
    where id = ${existing.id}
  `;

  await sql`
    insert into nextauth_accounts (
      user_id,
      type,
      provider,
      provider_account_id,
      access_token,
      refresh_token,
      expires_at,
      token_type,
      scope,
      id_token,
      session_state
    )
    values (
      ${existing.id},
      ${input.type ?? 'oauth'},
      ${input.provider},
      ${input.providerAccountId},
      ${input.accessToken ?? null},
      ${input.refreshToken ?? null},
      ${input.expiresAt ?? null},
      ${input.tokenType ?? null},
      ${input.scope ?? null},
      ${input.idToken ?? null},
      ${input.sessionState ?? null}
    )
    on conflict (provider, provider_account_id)
    do update
      set
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        token_type = excluded.token_type,
        scope = excluded.scope,
        id_token = excluded.id_token,
        session_state = excluded.session_state
    where nextauth_accounts.user_id = excluded.user_id
  `;

  const [linked] = await sql<{ linked: boolean }[]>`
    select exists(
      select 1
      from nextauth_accounts
      where provider = ${input.provider}
        and provider_account_id = ${input.providerAccountId}
        and user_id = ${existing.id}
      limit 1
    ) as linked
  `;

  if (!linked?.linked) {
    return { ok: false };
  }

  return { ok: true, userId: existing.id };
}
