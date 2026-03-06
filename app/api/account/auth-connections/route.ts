import { NextResponse } from 'next/server';
import { sql } from '@/app/lib/db';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  disconnectProvider,
  fetchAuthConnections,
  fetchSignInMethodsState,
  type AuthProvider,
} from '@/app/lib/auth-connections';
import { enforceRateLimit, parseQuery } from '@/app/lib/security/api-guard';

export const __testHooks: {
  authOverride: null | (() => Promise<{ user?: { id?: string; email?: string | null } } | null>);
  enforceRateLimitOverride: null | typeof enforceRateLimit;
} = {
  authOverride: null,
  enforceRateLimitOverride: null,
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function resolveSessionUserId() {
  const session = await (__testHooks.authOverride ?? auth)();
  const explicitId = (session?.user as { id?: string } | undefined)?.id;
  if (explicitId) {
    return explicitId;
  }

  const email = session?.user?.email ? normalizeEmail(session.user.email) : null;
  if (!email) {
    return null;
  }

  const [user] = await sql<{ id: string }[]>`
    select id
    from users
    where lower(email) = ${email}
    limit 1
  `;

  return user?.id ?? null;
}

const authConnectionsDeleteQuerySchema = z
  .object({
    provider: z.enum(['google', 'github']),
  })
  .strict();

export async function GET() {
  const userId = await resolveSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const connections = await fetchAuthConnections(userId);
  const signInMethods = await fetchSignInMethodsState(userId);
  return NextResponse.json({
    providers: connections.map((connection) => ({
      provider: connection.provider,
      connectedAt: connection.connectedAt.toISOString(),
    })),
    signInMethods: {
      hasPassword: signInMethods?.hasPassword ?? false,
      providerCount: signInMethods?.connectedProviders.length ?? 0,
    },
  });
}

export async function DELETE(request: Request) {
  const userId = await resolveSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const session = await (__testHooks.authOverride ?? auth)();
  const userEmail = session?.user?.email ? normalizeEmail(session.user.email) : null;

  const rl = await (__testHooks.enforceRateLimitOverride ?? enforceRateLimit)(
    request,
    {
      bucket: 'account_auth_connections_delete',
      windowSec: 300,
      ipLimit: 30,
      userLimit: 10,
    },
    {
      userKey: userEmail ?? undefined,
      failClosed: true,
    },
  );
  if (rl) return rl;

  const url = new URL(request.url);
  const parsedQuery = parseQuery(authConnectionsDeleteQuerySchema, url);
  if (!parsedQuery.ok) return parsedQuery.response;

  const providerParam = parsedQuery.data.provider;

  const result = await disconnectProvider(userId, providerParam as AuthProvider);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        status: result.status,
        error: result.message,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, removed: result.removed });
}
