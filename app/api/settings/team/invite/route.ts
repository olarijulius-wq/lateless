import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createWorkspaceInvite,
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  TEAM_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/workspaces';
import { sendWorkspaceInviteEmail } from '@/app/lib/email';
import { enforceRateLimit, parseJsonBody } from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const inviteSchema = z
  .object({
    email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
    role: z.enum(['admin', 'member']),
  })
  .strict();

function resolveBaseUrl(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : new URL(req.url).origin)
  );
}

export async function POST(request: NextRequest) {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only workspace owners or admins can invite members.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'team_invite',
        windowSec: 300,
        ipLimit: 10,
        userLimit: 5,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

    const parsedBody = await parseJsonBody(request, inviteSchema);
    if (!parsedBody.ok) return parsedBody.response;

    const invite = await createWorkspaceInvite({
      workspaceId: context.workspaceId,
      invitedByUserId: context.userId,
      email: parsedBody.data.email,
      role: parsedBody.data.role,
    });

    const inviteUrl = `${resolveBaseUrl(request)}/invite/${invite.token}`;

    try {
      await sendWorkspaceInviteEmail({
        to: parsedBody.data.email,
        invitedByEmail: context.userEmail,
        workspaceName: context.workspaceName,
        inviteUrl,
        role: parsedBody.data.role,
      });
    } catch (error) {
      console.error('Team invite email failed:', error);
    }

    return NextResponse.json({
      ok: true,
      message: 'Invite created and email sent if mail provider is configured.',
    });
  } catch (error) {
    if (isTeamMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: TEAM_MIGRATION_REQUIRED_CODE,
          message:
            'Team requires DB migrations 007_add_workspaces_and_team.sql and 013_add_active_workspace_and_company_profile_workspace_scope.sql. Run migrations and retry.',
        },
        { status: 503 },
      );
    }

    console.error('Create invite failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to create invite.' },
      { status: 500 },
    );
  }
}
