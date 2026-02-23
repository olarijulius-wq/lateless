import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';
import { z } from 'zod';
import { auth } from '@/auth';
import { enforceRateLimit, parseQuery } from '@/app/lib/security/api-guard';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const linkProviderQuerySchema = z
  .object({
    provider: z.enum(['google', 'github']),
  })
  .strict();

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

export async function POST(request: NextRequest) {
  const userId = await resolveSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const session = await auth();
  const userEmail = session?.user?.email ? normalizeEmail(session.user.email) : null;

  const rl = await enforceRateLimit(
    request,
    {
      bucket: 'account_link_provider',
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
  const parsedQuery = parseQuery(linkProviderQuerySchema, url);
  if (!parsedQuery.ok) return parsedQuery.response;

  const { provider } = parsedQuery.data;

  return NextResponse.json({
    ok: true,
    provider,
    callbackUrl: '/dashboard/profile',
    method: 'Use next-auth signIn(provider, { callbackUrl }) client-side.',
  });
}
