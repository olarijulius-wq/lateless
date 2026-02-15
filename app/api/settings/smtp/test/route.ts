import { NextResponse } from 'next/server';
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

export const runtime = 'nodejs';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { toEmail?: unknown }
    | null;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Only owners can send test emails.' },
        { status: 403 },
      );
    }

    const toEmailRaw = typeof body?.toEmail === 'string' ? body.toEmail : '';
    const toEmail = toEmailRaw.trim() ? normalizeEmail(toEmailRaw) : context.userEmail;
    if (!/^\S+@\S+\.\S+$/.test(toEmail)) {
      return NextResponse.json(
        { ok: false, message: 'Please provide a valid email address.' },
        { status: 400 },
      );
    }

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
