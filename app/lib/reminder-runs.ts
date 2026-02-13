import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export const REMINDER_RUNS_MIGRATION_REQUIRED_CODE =
  'REMINDER_RUNS_MIGRATION_REQUIRED';

export type ReminderRunTriggeredBy = 'manual' | 'cron' | 'dev';

export type ReminderRunSkippedBreakdown = {
  paused?: number;
  unsubscribed?: number;
  missing_email?: number;
  not_eligible?: number;
  other?: number;
};

export type ReminderRunErrorItem = {
  invoiceId: string;
  message: string;
};

export type ReminderRunInsertPayload = {
  triggeredBy: ReminderRunTriggeredBy;
  dryRun: boolean;
  sentCount: number;
  skippedCount: number;
  errorCount: number;
  skippedBreakdown: ReminderRunSkippedBreakdown;
  durationMs: number | null;
  errors: ReminderRunErrorItem[];
  ranAt?: string | Date;
};

export type ReminderRunRecord = {
  id: string;
  workspaceId: string;
  ranAt: string;
  triggeredBy: ReminderRunTriggeredBy;
  dryRun: boolean;
  sentCount: number;
  skippedCount: number;
  errorCount: number;
  skippedBreakdown: ReminderRunSkippedBreakdown;
  durationMs: number | null;
  errors: ReminderRunErrorItem[];
};

function buildReminderRunsMigrationRequiredError() {
  const error = new Error(REMINDER_RUNS_MIGRATION_REQUIRED_CODE) as Error & {
    code: string;
  };
  error.code = REMINDER_RUNS_MIGRATION_REQUIRED_CODE;
  return error;
}

export function isReminderRunsMigrationRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ((error as { code?: string }).code === REMINDER_RUNS_MIGRATION_REQUIRED_CODE ||
      error.message === REMINDER_RUNS_MIGRATION_REQUIRED_CODE)
  );
}

let reminderRunsSchemaReadyPromise: Promise<void> | null = null;

export async function assertReminderRunsSchemaReady(): Promise<void> {
  if (!reminderRunsSchemaReadyPromise) {
    reminderRunsSchemaReadyPromise = (async () => {
      const [result] = await sql<{
        runs: string | null;
      }[]>`
        select to_regclass('public.workspace_reminder_runs') as runs
      `;

      if (!result?.runs) {
        throw buildReminderRunsMigrationRequiredError();
      }
    })();
  }

  return reminderRunsSchemaReadyPromise;
}

export async function insertReminderRun(
  workspaceId: string,
  payload: ReminderRunInsertPayload,
) {
  await assertReminderRunsSchemaReady();

  const ranAt =
    payload.ranAt instanceof Date
      ? payload.ranAt.toISOString()
      : typeof payload.ranAt === 'string'
        ? payload.ranAt
        : null;

  const [row] = await sql<{
    id: string;
    workspace_id: string;
    ran_at: Date;
    triggered_by: ReminderRunTriggeredBy;
    dry_run: boolean;
    sent_count: number;
    skipped_count: number;
    error_count: number;
    skipped_breakdown: ReminderRunSkippedBreakdown;
    duration_ms: number | null;
    errors: ReminderRunErrorItem[];
  }[]>`
    insert into public.workspace_reminder_runs (
      workspace_id,
      ran_at,
      triggered_by,
      dry_run,
      sent_count,
      skipped_count,
      error_count,
      skipped_breakdown,
      duration_ms,
      errors
    )
    values (
      ${workspaceId},
      coalesce(${ranAt}::timestamptz, now()),
      ${payload.triggeredBy},
      ${payload.dryRun},
      ${payload.sentCount},
      ${payload.skippedCount},
      ${payload.errorCount},
      ${JSON.stringify(payload.skippedBreakdown)}::jsonb,
      ${payload.durationMs},
      ${JSON.stringify(payload.errors)}::jsonb
    )
    returning
      id,
      workspace_id,
      ran_at,
      triggered_by,
      dry_run,
      sent_count,
      skipped_count,
      error_count,
      skipped_breakdown,
      duration_ms,
      errors
  `;

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ranAt: row.ran_at.toISOString(),
    triggeredBy: row.triggered_by,
    dryRun: row.dry_run,
    sentCount: row.sent_count,
    skippedCount: row.skipped_count,
    errorCount: row.error_count,
    skippedBreakdown: row.skipped_breakdown ?? {},
    durationMs: row.duration_ms,
    errors: Array.isArray(row.errors) ? row.errors : [],
  } satisfies ReminderRunRecord;
}

export async function listReminderRuns(workspaceId: string, limit = 25) {
  await assertReminderRunsSchemaReady();

  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(100, Math.trunc(limit)))
    : 25;

  const rows = await sql<{
    id: string;
    workspace_id: string;
    ran_at: Date;
    triggered_by: ReminderRunTriggeredBy;
    dry_run: boolean;
    sent_count: number;
    skipped_count: number;
    error_count: number;
    skipped_breakdown: ReminderRunSkippedBreakdown;
    duration_ms: number | null;
    errors: ReminderRunErrorItem[];
  }[]>`
    select
      id,
      workspace_id,
      ran_at,
      triggered_by,
      dry_run,
      sent_count,
      skipped_count,
      error_count,
      skipped_breakdown,
      duration_ms,
      errors
    from public.workspace_reminder_runs
    where workspace_id = ${workspaceId}
    order by ran_at desc
    limit ${safeLimit}
  `;

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    ranAt: row.ran_at.toISOString(),
    triggeredBy: row.triggered_by,
    dryRun: row.dry_run,
    sentCount: row.sent_count,
    skippedCount: row.skipped_count,
    errorCount: row.error_count,
    skippedBreakdown: row.skipped_breakdown ?? {},
    durationMs: row.duration_ms,
    errors: Array.isArray(row.errors) ? row.errors : [],
  })) satisfies ReminderRunRecord[];
}
