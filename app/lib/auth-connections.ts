import { sql } from '@/app/lib/db';

export type AuthProvider = 'google' | 'github';

export type AuthConnection = {
  provider: AuthProvider;
  connectedAt: Date;
};

type DisconnectProviderResult =
  | { ok: true; removed: boolean }
  | { ok: false; message: string; code: string; status: number };

export type SignInMethodsState = {
  hasPassword: boolean;
  connectedProviders: AuthProvider[];
};

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

export async function fetchSignInMethodsState(
  userId: string,
): Promise<SignInMethodsState | null> {
  const [userState] = await sql<{
    password: string | null;
    connected_providers: AuthProvider[] | null;
  }[]>`
    select
      u.password,
      coalesce(
        (
          select array_agg(provider::text)::text[]
          from (
            select distinct provider
            from nextauth_accounts a
            where a.user_id = u.id
              and a.provider in ('google', 'github')
            order by provider asc
          ) provider_rows
        ),
        array[]::text[]
      ) as connected_providers
    from users u
    where u.id = ${userId}
    limit 1
  `;

  if (!userState) return null;

  return {
    hasPassword: Boolean(userState.password && userState.password.trim()),
    connectedProviders: (userState.connected_providers ?? []) as AuthProvider[],
  };
}

export async function disconnectProvider(
  userId: string,
  provider: AuthProvider,
): Promise<DisconnectProviderResult> {
  const normalizedProvider = provider.trim().toLowerCase() as AuthProvider;
  if (normalizedProvider !== 'google' && normalizedProvider !== 'github') {
    return {
      ok: false,
      code: 'INVALID_PROVIDER',
      status: 400,
      message: 'Invalid provider.',
    };
  }

  const userState = await fetchSignInMethodsState(userId);

  if (!userState) {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      status: 401,
      message: 'Unauthorized.',
    };
  }

  const remainingProvidersCount = userState.connectedProviders.filter(
    (connectedProvider) => connectedProvider !== normalizedProvider,
  ).length;
  const currentlyConnected = userState.connectedProviders.includes(normalizedProvider);
  const remainingMethodsCount = remainingProvidersCount + (userState.hasPassword ? 1 : 0);
  if (currentlyConnected && remainingMethodsCount <= 0) {
    return {
      ok: false,
      code: 'CANNOT_DISCONNECT_LAST_LOGIN_METHOD',
      status: 409,
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
