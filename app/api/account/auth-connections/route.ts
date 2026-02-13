import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { auth } from '@/auth';
import {
  disconnectProvider,
  fetchAuthConnections,
  type AuthProvider,
} from '@/app/lib/auth-connections';

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

  const { searchParams } = new URL(request.url);
  const providerParam = searchParams.get('provider')?.trim().toLowerCase();
  if (providerParam !== 'google' && providerParam !== 'github') {
    return NextResponse.json({ message: 'Invalid provider' }, { status: 400 });
  }

  const result = await disconnectProvider(userId, providerParam as AuthProvider);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, removed: result.removed });
}
