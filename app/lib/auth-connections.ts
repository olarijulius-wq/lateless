import postgres from 'postgres';

export type AuthProvider = 'google' | 'github';

export type AuthConnection = {
  provider: AuthProvider;
  connectedAt: Date;
};

type DisconnectProviderResult =
  | { ok: true; removed: boolean }
  | { ok: false; message: string };

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function fetchAuthConnections(userId: string): Promise<AuthConnection[]> {
  const rows = await sql<{ provider: AuthProvider; connected_at: Date }[]>`
    select provider, min(created_at) as connected_at
    from nextauth_accounts
    where user_id = ${userId}
      and provider in ('google', 'github')
    group by provider
    order by provider asc
  `;

  return rows.map((row) => ({
    provider: row.provider,
    connectedAt: row.connected_at,
  }));
}

export async function isProviderConnected(
  userId: string,
  provider: AuthProvider,
): Promise<boolean> {
  const normalizedProvider = provider.trim().toLowerCase() as AuthProvider;
  if (normalizedProvider !== 'google' && normalizedProvider !== 'github') {
    return false;
  }

  const [row] = await sql<{ connected: boolean }[]>`
    select exists(
      select 1
      from nextauth_accounts
      where user_id = ${userId}
        and provider = ${normalizedProvider}
      limit 1
    ) as connected
  `;

  return Boolean(row?.connected);
}

export async function fetchConnectedProviders(
  userId: string,
): Promise<AuthProvider[]> {
  const rows = await sql<{ provider: AuthProvider }[]>`
    select distinct provider
    from nextauth_accounts
    where user_id = ${userId}
      and provider in ('google', 'github')
  `;

  return rows.map((row) => row.provider);
}

export async function disconnectProvider(
  userId: string,
  provider: AuthProvider,
): Promise<DisconnectProviderResult> {
  const normalizedProvider = provider.trim().toLowerCase() as AuthProvider;
  if (normalizedProvider !== 'google' && normalizedProvider !== 'github') {
    return { ok: false, message: 'Invalid provider.' };
  }

  const [userState] = await sql<{
    password: string | null;
    connected_count: number;
  }[]>`
    select
      u.password,
      (
        select count(*)::int
        from nextauth_accounts a
        where a.user_id = u.id
          and a.provider in ('google', 'github')
      ) as connected_count
    from users u
    where u.id = ${userId}
    limit 1
  `;

  if (!userState) {
    return { ok: false, message: 'Unauthorized' };
  }

  const hasPassword = Boolean(userState.password && userState.password.trim());
  if (!hasPassword && userState.connected_count <= 1) {
    return {
      ok: false,
      message: "You can’t disconnect your last sign-in method. Set a password first.",
    };
  }

  const [deleted] = await sql<{ id: string }[]>`
    delete from nextauth_accounts
    where user_id = ${userId}
      and provider = ${normalizedProvider}
    returning id
  `;

  return { ok: true, removed: Boolean(deleted?.id) };
}
