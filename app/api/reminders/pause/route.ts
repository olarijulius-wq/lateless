import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';
import { z } from 'zod';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  TEAM_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/workspaces';
import {
  isReminderPauseMigrationRequiredError,
  pauseCustomer,
  pauseInvoice,
  REMINDER_PAUSE_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/reminder-pauses';
import {
  emailSchema,
  enforceRateLimit,
  parseJsonBody,
  uuidSchema,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const migrationMessage =
  'Reminder pauses require DB migration 015_add_reminder_pauses.sql. Run migrations and retry.';

const remindersPauseBodySchema = z.discriminatedUnion('scope', [
  z
    .object({
      scope: z.literal('customer'),
      email: emailSchema,
      reason: z.string().trim().max(500).optional(),
    })
    .strict(),
  z
    .object({
      scope: z.literal('invoice'),
      invoiceId: uuidSchema,
      reason: z.string().trim().max(500).optional(),
    })
    .strict(),
]);

async function invoiceBelongsToWorkspace(workspaceId: string, invoiceId: string) {
  const [row] = await sql<{ id: string }[]>`
    select invoices.id
    from public.invoices
    join public.users
      on lower(users.email) = lower(invoices.user_email)
    join public.workspace_members wm
      on wm.user_id = users.id
     and wm.workspace_id = ${workspaceId}
    where invoices.id = ${invoiceId}
    limit 1
  `;

  return Boolean(row?.id);
}

export async function POST(request: NextRequest) {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only owners and admins can pause reminders.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'reminders_pause',
        windowSec: 60,
        ipLimit: 30,
        userLimit: 20,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

    const parsedBody = await parseJsonBody(request, remindersPauseBodySchema);
    if (!parsedBody.ok) return parsedBody.response;

    const body = parsedBody.data;

    if (body.scope === 'customer') {
      await pauseCustomer(context.workspaceId, body.email, context.userId, body.reason ?? undefined);

      return NextResponse.json({
        ok: true,
        scope: 'customer',
        normalizedEmail: body.email,
      });
    }

    const canAccessInvoice = await invoiceBelongsToWorkspace(
      context.workspaceId,
      body.invoiceId,
    );

    if (!canAccessInvoice) {
      return NextResponse.json(
        { ok: false, message: 'Invoice not found in active workspace.' },
        { status: 404 },
      );
    }

    await pauseInvoice(body.invoiceId, context.userId, body.reason ?? undefined);

    return NextResponse.json({
      ok: true,
      scope: 'invoice',
      invoiceId: body.invoiceId,
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

    if (isReminderPauseMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: REMINDER_PAUSE_MIGRATION_REQUIRED_CODE,
          message: migrationMessage,
        },
        { status: 503 },
      );
    }

    console.error('Pause reminder failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to pause reminder.' },
      { status: 500 },
    );
  }
}
