import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
} from '@/app/lib/workspaces';
import {
  isUnsubscribeMigrationRequiredError,
  normalizeEmail,
  resubscribeRecipient,
  UNSUBSCRIBE_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/unsubscribe';
import {
  enforceRateLimit,
  parseJsonBody,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const migrationMessage =
  'Unsubscribe requires DB migrations 007_add_workspaces_and_team.sql and 009_add_unsubscribe.sql. Run migrations and retry.';
const resubscribeBodySchema = z
  .object({
    email: z.string().trim().min(1),
  })
  .strict();

export async function POST(request: NextRequest) {
  const parsedBody = await parseJsonBody(request, resubscribeBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const emailRaw = parsedBody.data.email;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only owners and admins can resubscribe recipients.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'unsubscribe_resubscribe',
        windowSec: 300,
        ipLimit: 20,
        userLimit: 10,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

    const removed = await resubscribeRecipient(
      context.workspaceId,
      normalizeEmail(emailRaw),
    );

    return NextResponse.json({
      ok: true,
      removed,
    });
  } catch (error) {
    if (isTeamMigrationRequiredError(error) || isUnsubscribeMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: UNSUBSCRIBE_MIGRATION_REQUIRED_CODE,
          message: migrationMessage,
        },
        { status: 503 },
      );
    }

    console.error('Resubscribe failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to resubscribe recipient.' },
      { status: 500 },
    );
  }
}
