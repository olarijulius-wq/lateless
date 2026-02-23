import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  TEAM_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/workspaces';
import {
  isSmtpMigrationRequiredError,
  sendWorkspaceTestEmail,
  SMTP_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/smtp-settings';
import {
  isRecipientUnsubscribed,
  isUnsubscribeMigrationRequiredError,
} from '@/app/lib/unsubscribe';
import { enforceRateLimit, parseJsonBody } from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const smtpTestBodySchema = z
  .object({
    toEmail: z.string().email().max(254).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Only owners can send test emails.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'smtp_test',
        windowSec: 300,
        ipLimit: 5,
        userLimit: 3,
      },
      {
        userKey: context.userEmail,
        failClosed: true,
      },
    );
    if (rl) return rl;

    const parsedBody = await parseJsonBody(request, smtpTestBodySchema);
    if (!parsedBody.ok) return parsedBody.response;

    const toEmailRaw = parsedBody.data.toEmail ?? '';
    const toEmail = toEmailRaw.trim() ? normalizeEmail(toEmailRaw) : context.userEmail;

    try {
      const unsubscribed = await isRecipientUnsubscribed(context.workspaceId, toEmail);
      if (unsubscribed) {
        return NextResponse.json(
          {
            ok: false,
            message:
              'Recipient is unsubscribed for this workspace. Marketing test email blocked.',
          },
          { status: 409 },
        );
      }
    } catch (unsubscribeError) {
      if (!isUnsubscribeMigrationRequiredError(unsubscribeError)) {
        throw unsubscribeError;
      }
    }

    await sendWorkspaceTestEmail({
      workspaceId: context.workspaceId,
      toEmail,
    });

    return NextResponse.json({
      ok: true,
      message: `Test email sent to ${toEmail}.`,
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

    if (isSmtpMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: SMTP_MIGRATION_REQUIRED_CODE,
          message:
            'SMTP requires DB migrations 008_add_workspace_email_settings.sql and 021_add_workspace_smtp_password_encryption.sql. Run migrations and retry.',
        },
        { status: 503 },
      );
    }

    console.error('SMTP test email failed:', error);
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Failed to send test email.',
      },
      { status: 500 },
    );
  }
}
