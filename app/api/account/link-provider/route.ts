import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';
import { auth } from '@/auth';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const ALLOWED_PROVIDERS = new Set(['google', 'github']);

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

  const provider = request.nextUrl.searchParams.get('provider')?.toLowerCase();
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ message: 'Invalid provider' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    provider,
    callbackUrl: '/dashboard/profile',
    method: 'Use next-auth signIn(provider, { callbackUrl }) client-side.',
  });
}
