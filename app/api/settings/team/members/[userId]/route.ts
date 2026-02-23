import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ensureWorkspaceContextForCurrentUser,
  fetchWorkspaceMembers,
  isTeamMigrationRequiredError,
  removeWorkspaceMember,
  TEAM_MIGRATION_REQUIRED_CODE,
  updateWorkspaceMemberRole,
} from '@/app/lib/workspaces';
import {
  enforceRateLimit,
  parseJsonBody,
  parseRouteParams,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

type RouteProps = {
  params: Promise<{ userId?: string }>;
};

const teamMemberParamsSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .strict();

const updateRoleBodySchema = z
  .object({
    role: z.enum(['admin', 'member']),
  })
  .strict();

export async function DELETE(request: Request, props: RouteProps) {
  const rawParams = await props.params;
  const parsedParams = parseRouteParams(teamMemberParamsSchema, rawParams);
  if (!parsedParams.ok) return parsedParams.response;
  const userId = parsedParams.data.userId;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only workspace owners or admins can remove members.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'team_member_remove',
        windowSec: 300,
        ipLimit: 20,
        userLimit: 10,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

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
  const rawParams = await props.params;
  const parsedParams = parseRouteParams(teamMemberParamsSchema, rawParams);
  if (!parsedParams.ok) return parsedParams.response;
  const userId = parsedParams.data.userId;

  const parsedBody = await parseJsonBody(request, updateRoleBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const role = parsedBody.data.role;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only workspace owners or admins can change roles.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'team_member_role_update',
        windowSec: 300,
        ipLimit: 20,
        userLimit: 10,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

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
