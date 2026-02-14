import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export const USAGE_MIGRATION_REQUIRED_CODE = 'USAGE_MIGRATION_REQUIRED';

export type UsageEventType =
  | 'invoice_created'
  | 'invoice_updated'
  | 'reminder_sent'
  | 'reminder_skipped'
  | 'reminder_error'
  | 'unsubscribe'
  | 'resubscribe'
  | 'smtp_test_sent';

export type UsageSummary = Record<UsageEventType, number>;

export type UsageTimeseriesPoint = {
  date: string;
  invoiceCreated: number;
  reminderSent: number;
  reminderSkipped: number;
  reminderError: number;
};

export type UsageTopReason = {
  reason: string;
  count: number;
};

function buildUsageMigrationRequiredError() {
  const error = new Error(USAGE_MIGRATION_REQUIRED_CODE) as Error & {
    code: string;
  };
  error.code = USAGE_MIGRATION_REQUIRED_CODE;
  return error;
}

export function isUsageMigrationRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ((error as { code?: string }).code === USAGE_MIGRATION_REQUIRED_CODE ||
      error.message === USAGE_MIGRATION_REQUIRED_CODE)
  );
}

let usageSchemaReadyPromise: Promise<void> | null = null;

export async function assertUsageSchemaReady(): Promise<void> {
  if (!usageSchemaReadyPromise) {
    usageSchemaReadyPromise = (async () => {
      const [result] = await sql<{ usage_events: string | null }[]>`
        select to_regclass('public.workspace_usage_events') as usage_events
      `;

      if (!result?.usage_events) {
        throw buildUsageMigrationRequiredError();
      }
    })();
  }

  return usageSchemaReadyPromise;
}

type RecordUsageEventInput = {
  workspaceId: string;
  eventType: UsageEventType;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
};

export async function recordUsageEvent(input: RecordUsageEventInput) {
  await assertUsageSchemaReady();
  const metadataJson = input.metadata ? sql.json(input.metadata) : null;

  await sql`
    insert into public.workspace_usage_events (
      workspace_id,
      event_type,
      entity_id,
      metadata
    )
    values (
      ${input.workspaceId},
      ${input.eventType},
      ${input.entityId ?? null},
      ${metadataJson}
    )
  `;
}

function emptySummary(): UsageSummary {
  return {
    invoice_created: 0,
    invoice_updated: 0,
    reminder_sent: 0,
    reminder_skipped: 0,
    reminder_error: 0,
    unsubscribe: 0,
    resubscribe: 0,
    smtp_test_sent: 0,
  };
}

export async function fetchUsageSummary(
  workspaceId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<UsageSummary> {
  await assertUsageSchemaReady();

  const rows = await sql<{ event_type: UsageEventType; count: string }[]>`
    select event_type, count(*)::text as count
    from public.workspace_usage_events
    where workspace_id = ${workspaceId}
      and occurred_at >= ${monthStart.toISOString()}
      and occurred_at < ${monthEnd.toISOString()}
    group by event_type
  `;

  const summary = emptySummary();

  for (const row of rows) {
    summary[row.event_type] = Number(row.count);
  }

  return summary;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfUtcDay(value: Date) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addUtcDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export async function fetchUsageTimeseries(
  workspaceId: string,
  days = 30,
): Promise<UsageTimeseriesPoint[]> {
  await assertUsageSchemaReady();

  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(90, days)) : 30;
  const todayUtc = startOfUtcDay(new Date());
  const startDate = addUtcDays(todayUtc, -(safeDays - 1));
  const endDateExclusive = addUtcDays(todayUtc, 1);

  const rows = await sql<{
    date: string;
    event_type: 'invoice_created' | 'reminder_sent' | 'reminder_skipped' | 'reminder_error';
    count: string;
  }[]>`
    select
      (occurred_at at time zone 'UTC')::date::text as date,
      event_type,
      count(*)::text as count
    from public.workspace_usage_events
    where workspace_id = ${workspaceId}
      and occurred_at >= ${startDate.toISOString()}
      and occurred_at < ${endDateExclusive.toISOString()}
      and event_type in (
        'invoice_created',
        'reminder_sent',
        'reminder_skipped',
        'reminder_error'
      )
    group by (occurred_at at time zone 'UTC')::date, event_type
  `;

  const byDate = new Map<string, UsageTimeseriesPoint>();
  for (let index = 0; index < safeDays; index += 1) {
    const date = toIsoDate(addUtcDays(startDate, index));
    byDate.set(date, {
      date,
      invoiceCreated: 0,
      reminderSent: 0,
      reminderSkipped: 0,
      reminderError: 0,
    });
  }

  for (const row of rows) {
    const point = byDate.get(row.date);
    if (!point) {
      continue;
    }

    const count = Number(row.count);
    if (row.event_type === 'invoice_created') {
      point.invoiceCreated = count;
      continue;
    }

    if (row.event_type === 'reminder_sent') {
      point.reminderSent = count;
      continue;
    }

    if (row.event_type === 'reminder_skipped') {
      point.reminderSkipped = count;
      continue;
    }

    point.reminderError = count;
  }

  return Array.from(byDate.values());
}

export async function fetchUsageTopReasons(
  workspaceId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<UsageTopReason[]> {
  await assertUsageSchemaReady();

  const rows = await sql<{ reason: string; count: string }[]>`
    select
      coalesce(nullif(trim(metadata->>'reason'), ''), 'other') as reason,
      count(*)::text as count
    from public.workspace_usage_events
    where workspace_id = ${workspaceId}
      and event_type = 'reminder_skipped'
      and occurred_at >= ${monthStart.toISOString()}
      and occurred_at < ${monthEnd.toISOString()}
    group by coalesce(nullif(trim(metadata->>'reason'), ''), 'other')
    order by count(*) desc, reason asc
    limit 5
  `;

  return rows.map((row) => ({
    reason: row.reason,
    count: Number(row.count),
  }));
}
