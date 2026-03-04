import 'server-only';

import {
  ensureWorkspaceContextForCurrentUser,
  type WorkspaceRole,
} from '@/app/lib/workspaces';

export type ResolvedWorkspaceContext = {
  userId: string;
  userEmail: string;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
};

function reportWorkspaceContextEvent(
  code: 'UNAUTHENTICATED' | 'NO_ACTIVE_WORKSPACE' | 'FORBIDDEN',
  details: { reason: string; userId?: string | null },
) {
  console.warn('[workspace-context]', {
    code,
    reason: details.reason,
    userId: details.userId ?? null,
  });
}

export class WorkspaceContextError extends Error {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NO_ACTIVE_WORKSPACE';
  status: 401 | 403 | 409;

  constructor(
    code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NO_ACTIVE_WORKSPACE',
    message: string,
  ) {
    super(message);
    this.code = code;
    this.status =
      code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : 409;
  }
}

export function isWorkspaceContextError(error: unknown): error is WorkspaceContextError {
  return error instanceof WorkspaceContextError;
}

export async function requireWorkspaceContext(): Promise<ResolvedWorkspaceContext> {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    if (!context.workspaceId?.trim()) {
      reportWorkspaceContextEvent('NO_ACTIVE_WORKSPACE', {
        reason: 'resolved context had empty workspaceId',
        userId: context.userId,
      });
      throw new WorkspaceContextError(
        'NO_ACTIVE_WORKSPACE',
        'No active workspace is configured for the current user.',
      );
    }
    return {
      userId: context.userId,
      userEmail: context.userEmail,
      workspaceId: context.workspaceId,
      workspaceName: context.workspaceName,
      role: context.userRole,
    };
  } catch (error) {
    if (isWorkspaceContextError(error)) {
      throw error;
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      reportWorkspaceContextEvent('UNAUTHENTICATED', {
        reason: 'missing auth session while requiring workspace context',
      });
      throw new WorkspaceContextError('UNAUTHORIZED', 'Unauthorized');
    }
    if (error instanceof Error && error.message === 'NO_ACTIVE_WORKSPACE') {
      reportWorkspaceContextEvent('NO_ACTIVE_WORKSPACE', {
        reason: 'authenticated user does not have resolvable workspace context',
      });
      throw new WorkspaceContextError(
        'NO_ACTIVE_WORKSPACE',
        'No active workspace is configured for the current user.',
      );
    }
    throw error;
  }
}

export async function requireWorkspaceRole(
  roles: WorkspaceRole[],
): Promise<ResolvedWorkspaceContext> {
  const context = await requireWorkspaceContext();
  if (!roles.includes(context.role)) {
    reportWorkspaceContextEvent('FORBIDDEN', {
      reason: `role ${context.role} missing one of required roles`,
      userId: context.userId,
    });
    throw new WorkspaceContextError(
      'FORBIDDEN',
      'You do not have access to this workspace resource.',
    );
  }
  return context;
}
