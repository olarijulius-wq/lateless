import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { ensureWorkspaceContextForCurrentUser } from '@/app/lib/workspaces';
import { isSettingsRemindersAdminEmail } from '@/app/lib/admin-gates';

export const runtime = 'nodejs';

function getBaseUrl(req: Request) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : new URL(req.url).origin)
  );
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email?.trim().toLowerCase() ?? '';

    if (!isSettingsRemindersAdminEmail(userEmail)) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const context = await ensureWorkspaceContextForCurrentUser();
    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    if (!isSettingsRemindersAdminEmail(context.userEmail)) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    let dryRun = false;
    if ((req.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
      const body = (await req.json().catch(() => null)) as { dryRun?: boolean } | null;
      dryRun = body?.dryRun === true;
    }

    const cronToken = process.env.REMINDER_CRON_TOKEN?.trim();
    if (!cronToken) {
      return NextResponse.json(
        { ok: false, error: 'REMINDER_CRON_TOKEN is not configured.' },
        { status: 500 },
      );
    }

    const activeWorkspaceId = context.workspaceId;
    const actorEmail = context.userEmail;

    const runUrl = new URL('/api/reminders/run', getBaseUrl(req));
    runUrl.searchParams.set('triggeredBy', 'manual');
    if (dryRun) {
      runUrl.searchParams.set('dryRun', '1');
    }

    const runResponse = await fetch(runUrl.toString(), {
      method: 'POST',
      headers: {
        'x-reminder-cron-token': cronToken,
        'x-dry-run': dryRun ? '1' : '0',
        'x-reminders-triggered-by': 'manual',
        'x-reminders-workspace-id': activeWorkspaceId,
        'x-reminders-user-email': actorEmail,
        'x-reminders-actor-email': actorEmail,
      },
      cache: 'no-store',
    });

    const payload = await runResponse.json().catch(() => null);

    if (runResponse.ok) {
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/(overview)');
      revalidatePath('/dashboard/reminders');
      revalidatePath('/dashboard/settings/reminders');
    }

    return NextResponse.json(payload, { status: runResponse.status });
  } catch (error) {
    console.error('Manual reminders run failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to run reminders manually.' },
      { status: 500 },
    );
  }
}
