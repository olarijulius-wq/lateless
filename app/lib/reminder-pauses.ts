import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export const REMINDER_PAUSE_MIGRATION_REQUIRED_CODE =
  'REMINDER_PAUSE_MIGRATION_REQUIRED';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildReminderPauseMigrationRequiredError() {
  const error = new Error(REMINDER_PAUSE_MIGRATION_REQUIRED_CODE) as Error & {
    code: string;
  };
  error.code = REMINDER_PAUSE_MIGRATION_REQUIRED_CODE;
  return error;
}

export function isReminderPauseMigrationRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ((error as { code?: string }).code === REMINDER_PAUSE_MIGRATION_REQUIRED_CODE ||
      error.message === REMINDER_PAUSE_MIGRATION_REQUIRED_CODE)
  );
}

let reminderPauseSchemaReadyPromise: Promise<void> | null = null;

export async function assertReminderPauseSchemaReady(): Promise<void> {
  if (!reminderPauseSchemaReadyPromise) {
    reminderPauseSchemaReadyPromise = (async () => {
      const [result] = await sql<{
        customer_pauses: string | null;
        invoice_pauses: string | null;
      }[]>`
        select
          to_regclass('public.workspace_reminder_customer_pauses') as customer_pauses,
          to_regclass('public.invoice_reminder_pauses') as invoice_pauses
      `;

      if (!result?.customer_pauses || !result?.invoice_pauses) {
        throw buildReminderPauseMigrationRequiredError();
      }
    })();
  }

  return reminderPauseSchemaReadyPromise;
}

export async function isCustomerPaused(workspaceId: string, email: string): Promise<boolean> {
  await assertReminderPauseSchemaReady();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  const [row] = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from public.workspace_reminder_customer_pauses
      where workspace_id = ${workspaceId}
        and normalized_email = ${normalizedEmail}
    ) as exists
  `;

  return Boolean(row?.exists);
}

export async function isInvoicePaused(invoiceId: string): Promise<boolean> {
  await assertReminderPauseSchemaReady();

  const [row] = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from public.invoice_reminder_pauses
      where invoice_id = ${invoiceId}
    ) as exists
  `;

  return Boolean(row?.exists);
}

export async function pauseCustomer(
  workspaceId: string,
  email: string,
  userId: string,
  reason?: string,
) {
  await assertReminderPauseSchemaReady();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('email');
  }

  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

  await sql`
    insert into public.workspace_reminder_customer_pauses (
      workspace_id,
      normalized_email,
      paused_at,
      paused_by_user_id,
      reason
    )
    values (
      ${workspaceId},
      ${normalizedEmail},
      now(),
      ${userId},
      ${trimmedReason || null}
    )
    on conflict (workspace_id, normalized_email)
    do update set
      paused_at = now(),
      paused_by_user_id = excluded.paused_by_user_id,
      reason = excluded.reason
  `;
}

export async function resumeCustomer(workspaceId: string, email: string) {
  await assertReminderPauseSchemaReady();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('email');
  }

  const result = await sql`
    delete from public.workspace_reminder_customer_pauses
    where workspace_id = ${workspaceId}
      and normalized_email = ${normalizedEmail}
    returning workspace_id
  `;

  return result.length > 0;
}

export async function pauseInvoice(invoiceId: string, userId: string, reason?: string) {
  await assertReminderPauseSchemaReady();
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

  await sql`
    insert into public.invoice_reminder_pauses (
      invoice_id,
      paused_at,
      paused_by_user_id,
      reason
    )
    values (
      ${invoiceId},
      now(),
      ${userId},
      ${trimmedReason || null}
    )
    on conflict (invoice_id)
    do update set
      paused_at = now(),
      paused_by_user_id = excluded.paused_by_user_id,
      reason = excluded.reason
  `;
}

export async function resumeInvoice(invoiceId: string) {
  await assertReminderPauseSchemaReady();

  const result = await sql`
    delete from public.invoice_reminder_pauses
    where invoice_id = ${invoiceId}
    returning invoice_id
  `;

  return result.length > 0;
}
