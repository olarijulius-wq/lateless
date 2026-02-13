import { NextRequest, NextResponse } from 'next/server';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  setActiveWorkspaceForCurrentUser,
  TEAM_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/workspaces';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { workspaceId?: unknown }
    | null;
  const workspaceId =
    typeof body?.workspaceId === 'string' ? body.workspaceId.trim() : '';

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, message: 'Workspace id is required.' },
      { status: 400 },
    );
  }

  try {
    await ensureWorkspaceContextForCurrentUser();
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
