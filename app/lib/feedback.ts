import postgres from 'postgres';
import { isInternalAdmin } from '@/app/lib/internal-admin-email';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export const FEEDBACK_MIGRATION_REQUIRED_CODE = 'FEEDBACK_MIGRATION_REQUIRED';
export const FEEDBACK_MIGRATION_FILE = '011_add_feedback.sql';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildFeedbackMigrationRequiredError() {
  const error = new Error(FEEDBACK_MIGRATION_REQUIRED_CODE) as Error & {
    code: string;
  };
  error.code = FEEDBACK_MIGRATION_REQUIRED_CODE;
  return error;
}

const REQUIRED_FEEDBACK_COLUMNS = ['id', 'user_email', 'message', 'created_at'];

export function isFeedbackMigrationRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ((error as { code?: string }).code === FEEDBACK_MIGRATION_REQUIRED_CODE ||
      error.message === FEEDBACK_MIGRATION_REQUIRED_CODE)
  );
}

export function isInternalAdminEmail(userEmail?: string | null) {
  return isInternalAdmin(userEmail);
}

export async function assertFeedbackSchemaReady(): Promise<void> {
  const [result] = await sql<{ feedback: string | null }[]>`
    select to_regclass('public.feedback') as feedback
  `;

  if (!result?.feedback) {
    throw buildFeedbackMigrationRequiredError();
  }

  const columns = await getFeedbackColumnSet();
  const hasRequiredColumns = REQUIRED_FEEDBACK_COLUMNS.every((column) =>
    columns.has(column),
  );

  if (!hasRequiredColumns) {
    throw buildFeedbackMigrationRequiredError();
  }
}

type CreateFeedbackInput = {
  userEmail: string;
  message: string;
  pagePath?: string | null;
  userAgent?: string | null;
};

function optionalText(value?: string | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getFeedbackColumnSet() {
  const rows = await sql<{ column_name: string }[]>`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'feedback'
  `;

  return new Set(rows.map((row) => row.column_name));
}

async function getOptionalFeedbackColumns() {
  const columns = await getFeedbackColumnSet();
  return {
    hasUserId: columns.has('user_id'),
    hasPagePath: columns.has('page_path'),
    hasUserAgent: columns.has('user_agent'),
  };
}

export async function createFeedback(input: CreateFeedbackInput): Promise<void> {
  await assertFeedbackSchemaReady();

  const userEmail = normalizeEmail(input.userEmail);
  const message = input.message.trim();
  const pagePath = optionalText(input.pagePath);
  const userAgent = optionalText(input.userAgent);
  const optionalColumns = await getOptionalFeedbackColumns();

  const [user] = await sql<{ id: string }[]>`
    select id
    from public.users
    where lower(email) = ${userEmail}
    limit 1
  `;

  const columnNames = ['user_email', 'message'];
  const values: Array<string | null> = [userEmail, message];

  if (optionalColumns.hasUserId) {
    columnNames.push('user_id');
    values.push(user?.id ?? null);
  }

  if (optionalColumns.hasPagePath) {
    columnNames.push('page_path');
    values.push(pagePath);
  }

  if (optionalColumns.hasUserAgent) {
    columnNames.push('user_agent');
    values.push(userAgent);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const query = `insert into public.feedback (${columnNames.join(', ')}) values (${placeholders})`;
  await sql.unsafe(query, values);
}

export type FeedbackItem = {
  id: string;
  userEmail: string;
  message: string;
  pagePath: string | null;
  createdAt: string;
};

export async function fetchLatestFeedback(limit = 100): Promise<FeedbackItem[]> {
  await assertFeedbackSchemaReady();
  const { hasPagePath } = await getOptionalFeedbackColumns();
  const normalizedLimit = Math.max(1, Math.min(limit, 100));

  const rows = hasPagePath
    ? await sql<{
        id: string;
        user_email: string;
        message: string;
        page_path: string | null;
        created_at: Date;
      }[]>`
        select
          id,
          user_email,
          message,
          page_path,
          created_at
        from public.feedback
        order by created_at desc
        limit ${normalizedLimit}
      `
    : await sql<{
        id: string;
        user_email: string;
        message: string;
        page_path: string | null;
        created_at: Date;
      }[]>`
        select
          id,
          user_email,
          message,
          null::text as page_path,
          created_at
        from public.feedback
        order by created_at desc
        limit ${normalizedLimit}
      `;

  return rows.map((row) => ({
    id: row.id,
    userEmail: normalizeEmail(row.user_email),
    message: row.message,
    pagePath: row.page_path,
    createdAt: row.created_at.toISOString(),
  }));
}
