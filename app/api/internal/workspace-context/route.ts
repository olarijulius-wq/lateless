import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/app/lib/db';
import { isInternalAdmin } from '@/app/lib/internal-admin-email';

export const runtime = 'nodejs';

function noindexJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function normalizeEmail(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; email?: string } | undefined;
  const sessionUserId = sessionUser?.id?.trim() || null;
  const sessionEmail = normalizeEmail(sessionUser?.email);

  if (!sessionUserId) {
    return noindexJson({ ok: false, code: 'UNAUTHENTICATED', error: 'Unauthorized' }, 401);
  }

  let actorEmail = sessionEmail;
  if (!actorEmail) {
    const [actorRow] = await sql<{ email: string | null }[]>`
      select email
      from public.users
      where id = ${sessionUserId}
      limit 1
    `;
    actorEmail = normalizeEmail(actorRow?.email);
  }

  if (!isInternalAdmin(actorEmail)) {
    return noindexJson({ ok: false, code: 'FORBIDDEN', error: 'Forbidden' }, 403);
  }

  const targetUserIdRaw = request.nextUrl.searchParams.get('userId');
  const targetUserId = targetUserIdRaw?.trim() || sessionUserId;

  const [membershipSummary] = await sql<{
    membership_count: string;
    active_workspace_id: string | null;
  }[]>`
    select
      count(wm.workspace_id)::text as membership_count,
      u.active_workspace_id
    from public.users u
    left join public.workspace_members wm on wm.user_id = u.id
    where u.id = ${targetUserId}
    group by u.active_workspace_id
  `;

  const membershipCount = Number.parseInt(membershipSummary?.membership_count ?? '0', 10) || 0;
  const activeWorkspaceId = membershipSummary?.active_workspace_id ?? null;

  return noindexJson({
    ok: true,
    userId: targetUserId,
    hasMembership: membershipCount > 0,
    activeWorkspaceId,
    membershipCount,
  });
}
