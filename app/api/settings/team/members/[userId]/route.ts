import { NextResponse } from 'next/server';
import {
  ensureWorkspaceContextForCurrentUser,
  fetchWorkspaceMembers,
  isTeamMigrationRequiredError,
  removeWorkspaceMember,
  TEAM_MIGRATION_REQUIRED_CODE,
  updateWorkspaceMemberRole,
} from '@/app/lib/workspaces';

export const runtime = 'nodejs';

type RouteProps = {
  params: Promise<{ userId?: string }>;
};

export async function DELETE(_: Request, props: RouteProps) {
  const params = await props.params;
  const userId = params.userId?.trim();

  if (!userId) {
    return NextResponse.json(
      { ok: false, message: 'Invalid user id.' },
      { status: 400 },
    );
  }

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only workspace owners or admins can remove members.' },
        { status: 403 },
      );
    }

    if (context.userId === userId) {
      return NextResponse.json(
        { ok: false, message: 'You cannot remove yourself.' },
        { status: 400 },
      );
    }

    const members = await fetchWorkspaceMembers(context.workspaceId);
    const target = members.find((member) => member.userId === userId);

    if (!target) {
      return NextResponse.json(
        { ok: false, message: 'Member not found.' },
        { status: 404 },
      );
    }

    if (target.role === 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Owner cannot be removed from the workspace.' },
        { status: 400 },
      );
    }

    const removed = await removeWorkspaceMember({
      workspaceId: context.workspaceId,
      targetUserId: userId,
    });

    if (!removed) {
      return NextResponse.json(
        { ok: false, message: 'Member not found or cannot be removed.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Member removed from workspace.',
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

    console.error('Remove workspace member failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to remove member.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, props: RouteProps) {
  const params = await props.params;
  const userId = params.userId?.trim();

  if (!userId) {
    return NextResponse.json(
      { ok: false, message: 'Invalid user id.' },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { role?: unknown }
    | null;
  const role = body?.role;

  if (role !== 'admin' && role !== 'member') {
    return NextResponse.json(
      { ok: false, message: 'Invalid role.' },
      { status: 400 },
    );
  }

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only workspace owners or admins can change roles.' },
        { status: 403 },
      );
    }

    if (context.userId === userId) {
      return NextResponse.json(
        { ok: false, message: 'You cannot change your own role.' },
        { status: 400 },
      );
    }

    const members = await fetchWorkspaceMembers(context.workspaceId);
    const target = members.find((member) => member.userId === userId);

    if (!target) {
      return NextResponse.json(
        { ok: false, message: 'Member not found.' },
        { status: 404 },
      );
    }

    if (target.role === 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Owner role cannot be changed.' },
        { status: 400 },
      );
    }

    const updated = await updateWorkspaceMemberRole({
      workspaceId: context.workspaceId,
      targetUserId: userId,
      role,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, message: 'Member not found or role unchanged.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Member role updated.',
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

    console.error('Update workspace member role failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to update member role.' },
      { status: 500 },
    );
  }
}
