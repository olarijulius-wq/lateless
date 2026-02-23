import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  setActiveWorkspaceForCurrentUser,
  TEAM_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/workspaces';
import {
  enforceRateLimit,
  parseJsonBody,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';
const activeWorkspaceBodySchema = z
  .object({
    workspaceId: z.string().uuid(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const parsedBody = await parseJsonBody(request, activeWorkspaceBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const workspaceId = parsedBody.data.workspaceId;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'team_active_switch',
        windowSec: 300,
        ipLimit: 30,
        userLimit: 12,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

    await setActiveWorkspaceForCurrentUser(workspaceId);

    return NextResponse.json({
      ok: true,
      message: 'Active team updated.',
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

    if (error instanceof Error && error.message === 'forbidden') {
      return NextResponse.json(
        { ok: false, message: 'You are not a member of that team.' },
        { status: 403 },
      );
    }

    console.error('Switch active workspace failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to switch team.' },
      { status: 500 },
    );
  }
}
