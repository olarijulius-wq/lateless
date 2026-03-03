import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureWorkspaceContextForCurrentUser } from '@/app/lib/workspaces';
import { dismissDunningBanner } from '@/app/lib/billing-dunning';
import { enforceRateLimit } from '@/app/lib/security/api-guard';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const userEmail = normalizeEmail(session.user.email);

  const rl = await enforceRateLimit(
    req,
    {
      bucket: 'billing_dismiss',
      windowSec: 300,
      ipLimit: 20,
      userLimit: 10,
    },
    { userKey: userEmail, failClosed: true },
  );
  if (rl) return rl;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    await dismissDunningBanner(context.workspaceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { ok: false, code: 'UNAUTHORIZED', error: 'Unauthorized' },
        { status: 401 },
      );
    }

    console.error('[billing] failed to dismiss recovery banner', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to dismiss billing banner.' },
      { status: 500 },
    );
  }
}
