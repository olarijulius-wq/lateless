import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export const REMINDER_RUN_LOGS_MIGRATION_REQUIRED_CODE =
  'REMINDER_RUN_LOGS_MIGRATION_REQUIRED';

export type ReminderRunLogTriggeredBy = 'manual' | 'cron';

export type ReminderRunLogInsertPayload = {
  triggeredBy: ReminderRunLogTriggeredBy;
  workspaceId?: string | null;
  userEmail?: string | null;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  hasMore: boolean;
  durationMs: number;
  rawJson: unknown;
  ranAt?: string | Date;
};

export type ReminderRunLogRecord = {
  id: string;
  ranAt: string;
  triggeredBy: string;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  hasMore: boolean;
  durationMs: number;
  rawJson: Record<string, unknown> | null;
};

function buildReminderRunLogsMigrationRequiredError() {
  const error = new Error(REMINDER_RUN_LOGS_MIGRATION_REQUIRED_CODE) as Error & {
    code: string;
  };
  error.code = REMINDER_RUN_LOGS_MIGRATION_REQUIRED_CODE;
  return error;
}

export function isReminderRunLogsMigrationRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ((error as { code?: string }).code ===
      REMINDER_RUN_LOGS_MIGRATION_REQUIRED_CODE ||
      error.message === REMINDER_RUN_LOGS_MIGRATION_REQUIRED_CODE)
  );
}

let reminderRunLogsSchemaReadyPromise: Promise<void> | null = null;
let reminderRunLogsSchemaMetaPromise: Promise<{
  hasWorkspaceId: boolean;
  hasUserEmail: boolean;
}> | null = null;

async function getReminderRunLogsSchemaMeta() {
  if (!reminderRunLogsSchemaMetaPromise) {
    reminderRunLogsSchemaMetaPromise = (async () => {
      const [result] = await sql<{
        runs: string | null;
        has_workspace_id: boolean;
        has_user_email: boolean;
      }[]>`
        select
          to_regclass('public.reminder_runs') as runs,
          exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'reminder_runs'
              and column_name = 'workspace_id'
          ) as has_workspace_id,
          exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'reminder_runs'
              and column_name = 'user_email'
          ) as has_user_email
      `;

      if (!result?.runs) {
        throw buildReminderRunLogsMigrationRequiredError();
      }

      return {
        hasWorkspaceId: result.has_workspace_id,
        hasUserEmail: result.has_user_email,
      };
    })();
  }

  return reminderRunLogsSchemaMetaPromise;
}

export async function assertReminderRunLogsSchemaReady(): Promise<void> {
  if (!reminderRunLogsSchemaReadyPromise) {
    reminderRunLogsSchemaReadyPromise = (async () => {
      await getReminderRunLogsSchemaMeta();
    })();
  }

  return reminderRunLogsSchemaReadyPromise;
}

export async function insertReminderRunLog(payload: ReminderRunLogInsertPayload) {
  const schemaMeta = await getReminderRunLogsSchemaMeta();

  const ranAt =
    payload.ranAt instanceof Date
      ? payload.ranAt.toISOString()
      : typeof payload.ranAt === 'string'
        ? payload.ranAt
        : null;
  const workspaceId = payload.workspaceId?.trim() || null;
  const userEmail = payload.userEmail?.trim().toLowerCase() || null;

  let row:
    | {
        id: string;
        ran_at: Date;
        triggered_by: string;
        attempted: number;
        sent: number;
        failed: number;
        skipped: number;
        has_more: boolean;
        duration_ms: number;
        raw_json: Record<string, unknown> | null;
      }
    | undefined;

  if (schemaMeta.hasWorkspaceId && schemaMeta.hasUserEmail) {
    [row] = await sql<{
      id: string;
      ran_at: Date;
      triggered_by: string;
      attempted: number;
      sent: number;
      failed: number;
      skipped: number;
      has_more: boolean;
      duration_ms: number;
      raw_json: Record<string, unknown> | null;
    }[]>`
      insert into public.reminder_runs (
        ran_at,
        triggered_by,
        workspace_id,
        user_email,
        attempted,
        sent,
        failed,
        skipped,
        has_more,
        duration_ms,
        raw_json
      )
      values (
        coalesce(${ranAt}::timestamptz, now()),
        ${payload.triggeredBy},
        ${workspaceId}::uuid,
        ${userEmail},
        ${payload.attempted},
        ${payload.sent},
        ${payload.failed},
        ${payload.skipped},
        ${payload.hasMore},
        ${payload.durationMs},
        ${JSON.stringify(payload.rawJson)}::jsonb
      )
      returning
        id,
        ran_at,
        triggered_by,
        attempted,
        sent,
        failed,
        skipped,
        has_more,
        duration_ms,
        raw_json
    `;
  } else if (schemaMeta.hasWorkspaceId) {
    [row] = await sql<{
      id: string;
      ran_at: Date;
      triggered_by: string;
      attempted: number;
      sent: number;
      failed: number;
      skipped: number;
      has_more: boolean;
      duration_ms: number;
      raw_json: Record<string, unknown> | null;
    }[]>`
      insert into public.reminder_runs (
        ran_at,
        triggered_by,
        workspace_id,
        attempted,
        sent,
        failed,
        skipped,
        has_more,
        duration_ms,
        raw_json
      )
      values (
        coalesce(${ranAt}::timestamptz, now()),
        ${payload.triggeredBy},
        ${workspaceId}::uuid,
        ${payload.attempted},
        ${payload.sent},
        ${payload.failed},
        ${payload.skipped},
        ${payload.hasMore},
        ${payload.durationMs},
        ${JSON.stringify(payload.rawJson)}::jsonb
      )
      returning
        id,
        ran_at,
        triggered_by,
        attempted,
        sent,
        failed,
        skipped,
        has_more,
        duration_ms,
        raw_json
    `;
  } else if (schemaMeta.hasUserEmail) {
    [row] = await sql<{
      id: string;
      ran_at: Date;
      triggered_by: string;
      attempted: number;
      sent: number;
      failed: number;
      skipped: number;
      has_more: boolean;
      duration_ms: number;
      raw_json: Record<string, unknown> | null;
    }[]>`
      insert into public.reminder_runs (
        ran_at,
        triggered_by,
        user_email,
        attempted,
        sent,
        failed,
        skipped,
        has_more,
        duration_ms,
        raw_json
      )
      values (
        coalesce(${ranAt}::timestamptz, now()),
        ${payload.triggeredBy},
        ${userEmail},
        ${payload.attempted},
        ${payload.sent},
        ${payload.failed},
        ${payload.skipped},
        ${payload.hasMore},
        ${payload.durationMs},
        ${JSON.stringify(payload.rawJson)}::jsonb
      )
      returning
        id,
        ran_at,
        triggered_by,
        attempted,
        sent,
        failed,
        skipped,
        has_more,
        duration_ms,
        raw_json
    `;
  } else {
    [row] = await sql<{
      id: string;
      ran_at: Date;
      triggered_by: string;
      attempted: number;
      sent: number;
      failed: number;
      skipped: number;
      has_more: boolean;
      duration_ms: number;
      raw_json: Record<string, unknown> | null;
    }[]>`
      insert into public.reminder_runs (
        ran_at,
        triggered_by,
        attempted,
        sent,
        failed,
        skipped,
        has_more,
        duration_ms,
        raw_json
      )
      values (
        coalesce(${ranAt}::timestamptz, now()),
        ${payload.triggeredBy},
        ${payload.attempted},
        ${payload.sent},
        ${payload.failed},
        ${payload.skipped},
        ${payload.hasMore},
        ${payload.durationMs},
        ${JSON.stringify(payload.rawJson)}::jsonb
      )
      returning
        id,
        ran_at,
        triggered_by,
        attempted,
        sent,
        failed,
        skipped,
        has_more,
        duration_ms,
        raw_json
    `;
  }

  if (!row) {
    throw new Error('Failed to write reminder run log.');
  }

  return {
    id: row.id,
    ranAt: row.ran_at.toISOString(),
    triggeredBy: row.triggered_by,
    attempted: row.attempted,
    sent: row.sent,
    failed: row.failed,
    skipped: row.skipped,
    hasMore: row.has_more,
    durationMs: row.duration_ms,
    rawJson: row.raw_json,
  } satisfies ReminderRunLogRecord;
}

export async function listReminderRunLogs(limit = 20) {
  await assertReminderRunLogsSchemaReady();

  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(100, Math.trunc(limit)))
    : 20;

  const rows = await sql<{
    id: string;
    ran_at: Date;
    triggered_by: string;
    attempted: number;
    sent: number;
    failed: number;
    skipped: number;
    has_more: boolean;
    duration_ms: number;
    raw_json: Record<string, unknown> | null;
  }[]>`
    select
      id,
      ran_at,
      triggered_by,
      attempted,
      sent,
      failed,
      skipped,
      has_more,
      duration_ms,
      raw_json
    from public.reminder_runs
    order by ran_at desc
    limit ${safeLimit}
  `;

  return rows.map((row) => ({
    id: row.id,
    ranAt: row.ran_at.toISOString(),
    triggeredBy: row.triggered_by,
    attempted: row.attempted,
    sent: row.sent,
    failed: row.failed,
    skipped: row.skipped,
    hasMore: row.has_more,
    durationMs: row.duration_ms,
    rawJson: row.raw_json,
  })) satisfies ReminderRunLogRecord[];
}
