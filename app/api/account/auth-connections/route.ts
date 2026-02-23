import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  disconnectProvider,
  fetchAuthConnections,
  type AuthProvider,
} from '@/app/lib/auth-connections';
import { enforceRateLimit, parseQuery } from '@/app/lib/security/api-guard';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function resolveSessionUserId() {
  const session = await auth();
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
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const connections = await fetchAuthConnections(userId);
  return NextResponse.json({
    providers: connections.map((connection) => ({
      provider: connection.provider,
      connectedAt: connection.connectedAt.toISOString(),
    })),
  });
}

export async function DELETE(request: Request) {
  const userId = await resolveSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const session = await auth();
  const userEmail = session?.user?.email ? normalizeEmail(session.user.email) : null;

  const rl = await enforceRateLimit(
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
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, removed: result.removed });
}
