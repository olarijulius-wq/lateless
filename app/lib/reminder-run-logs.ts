import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export const REMINDER_RUN_LOGS_MIGRATION_REQUIRED_CODE =
  'REMINDER_RUN_LOGS_MIGRATION_REQUIRED';

export type ReminderRunLogTriggeredBy = 'manual' | 'cron';

export type ReminderRunLogConfig = {
  batchSize: number;
  throttleMs: number;
  maxRunMs: number;
  dryRun: boolean;
};

export type ReminderRunLogInsertPayload = {
  triggeredBy: ReminderRunLogTriggeredBy;
  workspaceId?: string | null;
  userEmail?: string | null;
  actorEmail?: string | null;
  config?: ReminderRunLogConfig | null;
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
  workspaceId: string | null;
  userEmail: string | null;
  actorEmail: string | null;
  config: ReminderRunLogConfig | null;
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

type ReminderRunLogsSchemaMeta = {
  hasWorkspaceId: boolean;
  hasUserEmail: boolean;
  hasActorEmail: boolean;
  hasConfig: boolean;
  hasHasMore: boolean;
  rawJsonType: string | null;
};

export type ReminderRunLogsScopeMode = 'workspace' | 'account';
export type ReminderRunsQueryScope = 'workspace' | 'all';
export type ReminderRunsQueryTriggeredBy = 'all' | 'cron' | 'manual';
export type ReminderRunsQueryHasMore = 'all' | 'true' | 'false';
export type ReminderRunsQuerySent = 'all' | 'gt0' | 'eq0';
export type ReminderRunsQueryLegacy = 'all' | 'legacy' | 'scoped';
export type ReminderRunsQuerySort =
  | 'ran_at'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'triggered_by'
  | 'actor_email';
export type ReminderRunsQueryDir = 'asc' | 'desc';

export type ReminderRunsQuery = {
  scope: ReminderRunsQueryScope;
  workspaceId?: string | null;
  userEmail?: string | null;
  q?: string;
  triggeredBy?: ReminderRunsQueryTriggeredBy;
  hasMore?: ReminderRunsQueryHasMore;
  sent?: ReminderRunsQuerySent;
  legacy?: ReminderRunsQueryLegacy;
  sort?: ReminderRunsQuerySort;
  dir?: ReminderRunsQueryDir;
  page?: number;
  pageSize?: number;
};

export type ReminderRunLogsPagedResult = {
  rows: ReminderRunLogRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  capabilities: {
    hasWorkspaceId: boolean;
    hasUserEmail: boolean;
    hasActorEmail: boolean;
    hasConfig: boolean;
    hasHasMore: boolean;
    hasSearchableNotes: boolean;
  };
};

let reminderRunLogsSchemaReadyPromise: Promise<void> | null = null;
let reminderRunLogsSchemaMetaPromise: Promise<ReminderRunLogsSchemaMeta> | null = null;

async function getReminderRunLogsSchemaMeta() {
  if (!reminderRunLogsSchemaMetaPromise) {
    reminderRunLogsSchemaMetaPromise = (async () => {
      const [result] = await sql<{
        runs: string | null;
        has_workspace_id: boolean;
        has_user_email: boolean;
        has_actor_email: boolean;
        has_config: boolean;
        has_has_more: boolean;
        raw_json_type: string | null;
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
          ) as has_user_email,
          exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'reminder_runs'
              and column_name = 'actor_email'
          ) as has_actor_email,
          exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'reminder_runs'
              and column_name = 'config'
          ) as has_config,
          exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'reminder_runs'
              and column_name = 'has_more'
          ) as has_has_more,
          (
            select c.data_type
            from information_schema.columns c
            where c.table_schema = 'public'
              and c.table_name = 'reminder_runs'
              and c.column_name = 'raw_json'
            limit 1
          ) as raw_json_type
      `;

      if (!result?.runs || !result.raw_json_type) {
        throw buildReminderRunLogsMigrationRequiredError();
      }

      return {
        hasWorkspaceId: result.has_workspace_id,
        hasUserEmail: result.has_user_email,
        hasActorEmail: result.has_actor_email,
        hasConfig: result.has_config,
        hasHasMore: result.has_has_more,
        rawJsonType: result.raw_json_type,
      };
    })();
  }

  return reminderRunLogsSchemaMetaPromise;
}

export async function getReminderRunLogsScopeMode(): Promise<ReminderRunLogsScopeMode> {
  const schemaMeta = await getReminderRunLogsSchemaMeta();
  return schemaMeta.hasWorkspaceId ? 'workspace' : 'account';
}

export async function assertReminderRunLogsSchemaReady(): Promise<void> {
  if (!reminderRunLogsSchemaReadyPromise) {
    reminderRunLogsSchemaReadyPromise = (async () => {
      await getReminderRunLogsSchemaMeta();
    })();
  }

  return reminderRunLogsSchemaReadyPromise;
}

function normalizeConfig(value: unknown): ReminderRunLogConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<string, unknown>;
  const batchSize = Number(source.batchSize);
  const throttleMs = Number(source.throttleMs);
  const maxRunMs = Number(source.maxRunMs);
  const dryRun = source.dryRun;

  if (
    !Number.isFinite(batchSize) ||
    !Number.isFinite(throttleMs) ||
    !Number.isFinite(maxRunMs) ||
    typeof dryRun !== 'boolean'
  ) {
    return null;
  }

  return {
    batchSize: Math.trunc(batchSize),
    throttleMs: Math.trunc(throttleMs),
    maxRunMs: Math.trunc(maxRunMs),
    dryRun,
  };
}

function mapReminderRunLogRow(row: {
  id: string;
  ran_at: Date;
  triggered_by: string;
  workspace_id: string | null;
  user_email: string | null;
  actor_email: string | null;
  config: Record<string, unknown> | null;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  has_more: boolean;
  duration_ms: number;
  raw_json: unknown;
}): ReminderRunLogRecord {
  let raw: Record<string, unknown> | null = null;
  if (row.raw_json && typeof row.raw_json === 'object') {
    raw = row.raw_json as Record<string, unknown>;
  } else if (typeof row.raw_json === 'string') {
    try {
      const parsed = JSON.parse(row.raw_json);
      raw = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      raw = null;
    }
  }
  const rawActorEmail =
    raw && typeof raw.actorEmail === 'string' ? raw.actorEmail.trim().toLowerCase() : null;
  const rawConfig =
    raw && typeof raw.config === 'object' && raw.config !== null ? raw.config : null;

  return {
    id: row.id,
    ranAt: row.ran_at.toISOString(),
    triggeredBy: row.triggered_by,
    workspaceId: row.workspace_id,
    userEmail: row.user_email,
    actorEmail: row.actor_email ?? rawActorEmail,
    config: normalizeConfig(row.config) ?? normalizeConfig(rawConfig),
    attempted: row.attempted,
    sent: row.sent,
    failed: row.failed,
    skipped: row.skipped,
    hasMore: row.has_more,
    durationMs: row.duration_ms,
    rawJson: raw,
  };
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
  const actorEmail = payload.actorEmail?.trim().toLowerCase() || null;
  const config = payload.config ? JSON.stringify(payload.config) : null;

  const columns = [
    'ran_at',
    'triggered_by',
    'attempted',
    'sent',
    'failed',
    'skipped',
    'has_more',
    'duration_ms',
    'raw_json',
  ];
  const values: Array<string | number | boolean | null> = [
    ranAt,
    payload.triggeredBy,
    payload.attempted,
    payload.sent,
    payload.failed,
    payload.skipped,
    payload.hasMore,
    payload.durationMs,
    JSON.stringify(payload.rawJson),
  ];

  if (schemaMeta.hasWorkspaceId) {
    columns.push('workspace_id');
    values.push(workspaceId);
  }

  if (schemaMeta.hasUserEmail) {
    columns.push('user_email');
    values.push(userEmail);
  }

  if (schemaMeta.hasActorEmail) {
    columns.push('actor_email');
    values.push(actorEmail);
  }

  if (schemaMeta.hasConfig) {
    columns.push('config');
    values.push(config);
  }

  const valueExpressions = [
    'coalesce($1::timestamptz, now())',
    '$2',
    '$3',
    '$4',
    '$5',
    '$6',
    '$7',
    '$8',
    schemaMeta.rawJsonType === 'json' || schemaMeta.rawJsonType === 'jsonb'
      ? '$9::jsonb'
      : '$9::text',
  ];

  valueExpressions.push(
    ...columns.slice(9).map((column, index) => {
      const placeholder = `$${10 + index}`;
      if (column === 'workspace_id') {
        return `${placeholder}::uuid`;
      }
      if (column === 'config') {
        return `${placeholder}::jsonb`;
      }
      return placeholder;
    }),
  );

  const query = `
    insert into public.reminder_runs (${columns.join(', ')})
    values (${valueExpressions.join(', ')})
    returning
      id,
      ran_at,
      triggered_by,
      ${schemaMeta.hasWorkspaceId ? 'workspace_id' : 'null::uuid as workspace_id'},
      ${schemaMeta.hasUserEmail ? 'user_email' : 'null::text as user_email'},
      ${schemaMeta.hasActorEmail ? 'actor_email' : 'null::text as actor_email'},
      ${schemaMeta.hasConfig ? 'config' : 'null::jsonb as config'},
      attempted,
      sent,
      failed,
      skipped,
      has_more,
      duration_ms,
      ${
        schemaMeta.rawJsonType === 'json' || schemaMeta.rawJsonType === 'jsonb'
          ? 'raw_json::jsonb as raw_json'
          : 'raw_json::text as raw_json'
      }
  `;

  const [row] = await sql.unsafe<{
    id: string;
    ran_at: Date;
    triggered_by: string;
    workspace_id: string | null;
    user_email: string | null;
    actor_email: string | null;
    config: Record<string, unknown> | null;
    attempted: number;
    sent: number;
    failed: number;
    skipped: number;
    has_more: boolean;
    duration_ms: number;
    raw_json: unknown;
  }[]>(query, values);

  if (!row) {
    throw new Error('Failed to write reminder run log.');
  }

  return mapReminderRunLogRow(row);
}

export async function listReminderRunLogs(options?: {
  scope?: 'workspace' | 'all';
  limit?: number;
  workspaceId?: string | null;
  userEmail?: string | null;
}) {
  const schemaMeta = await getReminderRunLogsSchemaMeta();
  const safeLimit = Number.isFinite(options?.limit)
    ? Math.max(1, Math.min(100, Math.trunc(options?.limit ?? 20)))
    : 20;
  const scope = options?.scope === 'all' ? 'all' : 'workspace';
  const workspaceId = options?.workspaceId?.trim() || null;
  const userEmail = options?.userEmail?.trim().toLowerCase() || null;

  const baseSelect = `
    select
      id,
      ran_at,
      triggered_by,
      ${schemaMeta.hasWorkspaceId ? 'workspace_id' : 'null::uuid as workspace_id'},
      ${schemaMeta.hasUserEmail ? 'user_email' : 'null::text as user_email'},
      ${schemaMeta.hasActorEmail ? 'actor_email' : 'null::text as actor_email'},
      ${schemaMeta.hasConfig ? 'config' : 'null::jsonb as config'},
      attempted,
      sent,
      failed,
      skipped,
      ${schemaMeta.hasHasMore ? 'has_more' : 'false as has_more'},
      duration_ms,
      ${
        schemaMeta.rawJsonType === 'json' || schemaMeta.rawJsonType === 'jsonb'
          ? 'raw_json::jsonb as raw_json'
          : 'raw_json::text as raw_json'
      }
    from public.reminder_runs
  `;

  let rows: Array<{
    id: string;
    ran_at: Date;
    triggered_by: string;
    workspace_id: string | null;
    user_email: string | null;
    actor_email: string | null;
    config: Record<string, unknown> | null;
    attempted: number;
    sent: number;
    failed: number;
    skipped: number;
    has_more: boolean;
    duration_ms: number;
    raw_json: unknown;
  }> = [];

  if (scope === 'all') {
    rows = await sql.unsafe(
      `${baseSelect}
       order by ran_at desc
       limit $1`,
      [safeLimit],
    );
  } else if (schemaMeta.hasWorkspaceId && workspaceId) {
    rows = await sql.unsafe(
      `${baseSelect}
       where workspace_id = $1::uuid
       order by ran_at desc
       limit $2`,
      [workspaceId, safeLimit],
    );
  } else if (schemaMeta.hasUserEmail && userEmail) {
    rows = await sql.unsafe(
      `${baseSelect}
       where lower(user_email) = $1
       order by ran_at desc
       limit $2`,
      [userEmail, safeLimit],
    );
  } else {
    rows = await sql.unsafe(
      `${baseSelect}
       order by ran_at desc
       limit $1`,
      [safeLimit],
    );
  }

  return rows.map((row) => mapReminderRunLogRow(row));
}

const DEFAULT_REMINDER_RUNS_PAGE_SIZE = 50;

function normalizeReminderRunsPageSize(pageSize: number | undefined): number {
  if (pageSize === 10 || pageSize === 25 || pageSize === 50 || pageSize === 100) {
    return pageSize;
  }
  return DEFAULT_REMINDER_RUNS_PAGE_SIZE;
}

function normalizeReminderRunsPage(page: number | undefined): number {
  if (!Number.isFinite(page) || !page || page < 1) {
    return 1;
  }
  return Math.trunc(page);
}

function normalizeReminderRunsScope(scope: string | undefined): ReminderRunsQueryScope {
  return scope === 'all' ? 'all' : 'workspace';
}

function normalizeReminderRunsTriggeredBy(
  triggeredBy: string | undefined,
): ReminderRunsQueryTriggeredBy {
  if (triggeredBy === 'cron' || triggeredBy === 'manual') {
    return triggeredBy;
  }
  return 'all';
}

function normalizeReminderRunsHasMore(hasMore: string | undefined): ReminderRunsQueryHasMore {
  if (hasMore === 'true' || hasMore === 'false') {
    return hasMore;
  }
  return 'all';
}

function normalizeReminderRunsSent(sent: string | undefined): ReminderRunsQuerySent {
  if (sent === 'gt0' || sent === 'eq0') {
    return sent;
  }
  return 'all';
}

function normalizeReminderRunsLegacy(legacy: string | undefined): ReminderRunsQueryLegacy {
  if (legacy === 'legacy' || legacy === 'scoped') {
    return legacy;
  }
  return 'all';
}

function normalizeReminderRunsSort(sort: string | undefined): ReminderRunsQuerySort {
  if (
    sort === 'ran_at' ||
    sort === 'sent' ||
    sort === 'failed' ||
    sort === 'skipped' ||
    sort === 'triggered_by' ||
    sort === 'actor_email'
  ) {
    return sort;
  }
  return 'ran_at';
}

function normalizeReminderRunsDir(dir: string | undefined): ReminderRunsQueryDir {
  if (dir === 'asc' || dir === 'desc') {
    return dir;
  }
  return 'desc';
}

function getReminderRunsOrderBySql(
  schemaMeta: ReminderRunLogsSchemaMeta,
  sort: ReminderRunsQuerySort,
  dir: ReminderRunsQueryDir,
) {
  if (sort === 'ran_at') {
    return `ran_at ${dir.toUpperCase()}, id DESC`;
  }
  if (sort === 'sent') {
    return `sent ${dir.toUpperCase()}, ran_at DESC, id DESC`;
  }
  if (sort === 'failed') {
    return `failed ${dir.toUpperCase()}, ran_at DESC, id DESC`;
  }
  if (sort === 'skipped') {
    return `skipped ${dir.toUpperCase()}, ran_at DESC, id DESC`;
  }
  if (sort === 'triggered_by') {
    return `lower(triggered_by) ${dir.toUpperCase()}, ran_at DESC, id DESC`;
  }
  if (sort === 'actor_email' && schemaMeta.hasActorEmail) {
    return `lower(actor_email) ${dir.toUpperCase()} NULLS LAST, ran_at DESC, id DESC`;
  }
  return `ran_at DESC, id DESC`;
}

export async function listReminderRunLogsPaged(
  query: ReminderRunsQuery,
): Promise<ReminderRunLogsPagedResult> {
  const schemaMeta = await getReminderRunLogsSchemaMeta();
  const page = normalizeReminderRunsPage(query.page);
  const pageSize = normalizeReminderRunsPageSize(query.pageSize);
  const offset = (page - 1) * pageSize;

  const scope = normalizeReminderRunsScope(query.scope);
  const workspaceId = query.workspaceId?.trim() || null;
  const userEmail = query.userEmail?.trim().toLowerCase() || null;
  const search = query.q?.trim() || '';
  const triggeredBy = normalizeReminderRunsTriggeredBy(query.triggeredBy);
  const hasMore = normalizeReminderRunsHasMore(query.hasMore);
  const sent = normalizeReminderRunsSent(query.sent);
  const legacy = normalizeReminderRunsLegacy(query.legacy);
  const sort = normalizeReminderRunsSort(query.sort);
  const dir = normalizeReminderRunsDir(query.dir);

  const whereClauses: string[] = [];
  const values: Array<string | number | boolean> = [];
  const pushValue = (value: string | number | boolean) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (scope === 'workspace') {
    if (schemaMeta.hasWorkspaceId && workspaceId) {
      whereClauses.push(`workspace_id = ${pushValue(workspaceId)}::uuid`);
    } else if (schemaMeta.hasUserEmail && userEmail) {
      whereClauses.push(`lower(user_email) = ${pushValue(userEmail)}`);
    }
  }

  if (triggeredBy !== 'all') {
    whereClauses.push(`triggered_by = ${pushValue(triggeredBy)}`);
  }

  if (schemaMeta.hasHasMore && hasMore !== 'all') {
    whereClauses.push(`has_more = ${pushValue(hasMore === 'true')}`);
  }

  if (sent === 'gt0') {
    whereClauses.push('sent > 0');
  } else if (sent === 'eq0') {
    whereClauses.push('sent = 0');
  }

  if (scope === 'all' && schemaMeta.hasWorkspaceId && legacy !== 'all') {
    whereClauses.push(legacy === 'legacy' ? 'workspace_id is null' : 'workspace_id is not null');
  }

  if (search.length > 0) {
    const like = `%${search}%`;
    const searchTerms: string[] = [`triggered_by ILIKE ${pushValue(like)}`];
    if (schemaMeta.hasActorEmail) {
      searchTerms.push(`coalesce(actor_email, '') ILIKE ${pushValue(like)}`);
    }
    if (schemaMeta.hasUserEmail) {
      searchTerms.push(`coalesce(user_email, '') ILIKE ${pushValue(like)}`);
    }
    if (schemaMeta.hasWorkspaceId) {
      searchTerms.push(`coalesce(workspace_id::text, '') ILIKE ${pushValue(like)}`);
    }
    if (schemaMeta.rawJsonType === 'json' || schemaMeta.rawJsonType === 'jsonb') {
      searchTerms.push(`coalesce(raw_json::jsonb->>'notes', '') ILIKE ${pushValue(like)}`);
    }
    whereClauses.push(`(${searchTerms.join(' OR ')})`);
  }

  const whereSql = whereClauses.length > 0 ? `where ${whereClauses.join(' and ')}` : '';
  const orderBySql = getReminderRunsOrderBySql(schemaMeta, sort, dir);

  const countRows = await sql.unsafe<{ count: string }[]>(
    `select count(*)::text as count from public.reminder_runs ${whereSql}`,
    values,
  );
  const totalCount = Number(countRows[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / pageSize);

  const selectValues = [...values, pageSize, offset];
  const limitPlaceholder = `$${values.length + 1}`;
  const offsetPlaceholder = `$${values.length + 2}`;

  const rows = await sql.unsafe<{
    id: string;
    ran_at: Date;
    triggered_by: string;
    workspace_id: string | null;
    user_email: string | null;
    actor_email: string | null;
    config: Record<string, unknown> | null;
    attempted: number;
    sent: number;
    failed: number;
    skipped: number;
    has_more: boolean;
    duration_ms: number;
    raw_json: unknown;
  }[]>(
    `
      select
        id,
        ran_at,
        triggered_by,
        ${schemaMeta.hasWorkspaceId ? 'workspace_id' : 'null::uuid as workspace_id'},
        ${schemaMeta.hasUserEmail ? 'user_email' : 'null::text as user_email'},
        ${schemaMeta.hasActorEmail ? 'actor_email' : 'null::text as actor_email'},
        ${schemaMeta.hasConfig ? 'config' : 'null::jsonb as config'},
        attempted,
        sent,
        failed,
        skipped,
        ${schemaMeta.hasHasMore ? 'has_more' : 'false as has_more'},
        duration_ms,
        ${
          schemaMeta.rawJsonType === 'json' || schemaMeta.rawJsonType === 'jsonb'
            ? 'raw_json::jsonb as raw_json'
            : 'raw_json::text as raw_json'
        }
      from public.reminder_runs
      ${whereSql}
      order by ${orderBySql}
      limit ${limitPlaceholder}
      offset ${offsetPlaceholder}
    `,
    selectValues,
  );

  return {
    rows: rows.map((row) => mapReminderRunLogRow(row)),
    totalCount,
    page,
    pageSize,
    totalPages,
    capabilities: {
      hasWorkspaceId: schemaMeta.hasWorkspaceId,
      hasUserEmail: schemaMeta.hasUserEmail,
      hasActorEmail: schemaMeta.hasActorEmail,
      hasConfig: schemaMeta.hasConfig,
      hasHasMore: schemaMeta.hasHasMore,
      hasSearchableNotes: schemaMeta.rawJsonType === 'json' || schemaMeta.rawJsonType === 'jsonb',
    },
  };
}
