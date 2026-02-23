import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
} from '@/app/lib/workspaces';
import {
  fetchUnsubscribeSettings,
  isUnsubscribeMigrationRequiredError,
  UNSUBSCRIBE_MIGRATION_REQUIRED_CODE,
  upsertUnsubscribeSettings,
} from '@/app/lib/unsubscribe';
import {
  enforceRateLimit,
  parseJsonBody,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const migrationMessage =
  'Unsubscribe requires DB migrations 007_add_workspaces_and_team.sql and 009_add_unsubscribe.sql. Run migrations and retry.';
const unsubscribeSettingsBodySchema = z
  .object({
    enabled: z.boolean().optional(),
    pageText: z.string().optional(),
  })
  .strict();

export async function GET() {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    const settings = await fetchUnsubscribeSettings(context.workspaceId);

    return NextResponse.json({
      ok: true,
      settings,
      userRole: context.userRole,
      canEditSettings: context.userRole === 'owner',
      canManageRecipients:
        context.userRole === 'owner' || context.userRole === 'admin',
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

    console.error('Load unsubscribe settings failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to load unsubscribe settings.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const parsedBody = await parseJsonBody(request, unsubscribeSettingsBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Only owners can change unsubscribe settings.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'unsubscribe_settings_update',
        windowSec: 300,
        ipLimit: 20,
        userLimit: 10,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

    const enabled = body.enabled === true;
    const pageText = typeof body.pageText === 'string' ? body.pageText : '';

    const settings = await upsertUnsubscribeSettings(context.workspaceId, {
      enabled,
      pageText,
    });

    return NextResponse.json({ ok: true, settings });
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

    console.error('Save unsubscribe settings failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to save unsubscribe settings.' },
      { status: 500 },
    );
  }
}
