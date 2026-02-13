import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  TEAM_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/workspaces';
import {
  isReminderPauseMigrationRequiredError,
  REMINDER_PAUSE_MIGRATION_REQUIRED_CODE,
  resumeCustomer,
  resumeInvoice,
} from '@/app/lib/reminder-pauses';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const migrationMessage =
  'Reminder pauses require DB migration 015_add_reminder_pauses.sql. Run migrations and retry.';

type PauseScope = 'customer' | 'invoice';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseBody(body: unknown): {
  scope: PauseScope;
  invoiceId: string | null;
  email: string | null;
} | null {
  const scope = (body as { scope?: unknown })?.scope;
  if (scope !== 'customer' && scope !== 'invoice') {
    return null;
  }

  const invoiceIdRaw = (body as { invoiceId?: unknown })?.invoiceId;
  const emailRaw = (body as { email?: unknown })?.email;

  return {
    scope,
    invoiceId: typeof invoiceIdRaw === 'string' && invoiceIdRaw.trim() ? invoiceIdRaw.trim() : null,
    email: typeof emailRaw === 'string' && emailRaw.trim() ? normalizeEmail(emailRaw) : null,
  };
}

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Body must include scope ('customer' or 'invoice') and corresponding email or invoiceId.",
      },
      { status: 400 },
    );
  }

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only owners and admins can resume reminders.' },
        { status: 403 },
      );
    }

    if (parsed.scope === 'customer') {
      if (!parsed.email) {
        return NextResponse.json(
          { ok: false, message: 'Email is required for customer scope.' },
          { status: 400 },
        );
      }

      const resumed = await resumeCustomer(context.workspaceId, parsed.email);

      return NextResponse.json({
        ok: true,
        scope: 'customer',
        normalizedEmail: parsed.email,
        resumed,
      });
    }

    if (!parsed.invoiceId) {
      return NextResponse.json(
        { ok: false, message: 'invoiceId is required for invoice scope.' },
        { status: 400 },
      );
    }

    const canAccessInvoice = await invoiceBelongsToWorkspace(
      context.workspaceId,
      parsed.invoiceId,
    );

    if (!canAccessInvoice) {
      return NextResponse.json(
        { ok: false, message: 'Invoice not found in active workspace.' },
        { status: 404 },
      );
    }

    const resumed = await resumeInvoice(parsed.invoiceId);

    return NextResponse.json({
      ok: true,
      scope: 'invoice',
      invoiceId: parsed.invoiceId,
      resumed,
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

    console.error('Resume reminder failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to resume reminder.' },
      { status: 500 },
    );
  }
}
