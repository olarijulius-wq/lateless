import 'server-only';

import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const JOB_LOCKS_MIGRATION_REQUIRED_CODE = 'JOB_LOCKS_MIGRATION_REQUIRED';

export function isJobLocksMigrationRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ((error as { code?: string }).code === JOB_LOCKS_MIGRATION_REQUIRED_CODE ||
      error.message === JOB_LOCKS_MIGRATION_REQUIRED_CODE)
  );
}

function buildJobLocksMigrationRequiredError() {
  const error = new Error(JOB_LOCKS_MIGRATION_REQUIRED_CODE) as Error & { code: string };
  error.code = JOB_LOCKS_MIGRATION_REQUIRED_CODE;
  return error;
}

let schemaReadyPromise: Promise<void> | null = null;

async function assertJobLocksSchemaReady() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const [row] = await sql<{ job_locks: string | null }[]>`
        select to_regclass('public.job_locks') as job_locks
      `;
      if (!row?.job_locks) {
        throw buildJobLocksMigrationRequiredError();
      }
    })();
  }
  return schemaReadyPromise;
}

export async function acquireJobLock(input: {
  lockKey: string;
  holder: string;
  ttlSeconds?: number;
}): Promise<boolean> {
  await assertJobLocksSchemaReady();

  const ttlSeconds =
    typeof input.ttlSeconds === 'number' && input.ttlSeconds > 0
      ? Math.trunc(input.ttlSeconds)
      : 300;

  const rows = await sql<{ lock_key: string }[]>`
    insert into public.job_locks (
      lock_key,
      holder,
      locked_until,
      updated_at
    )
    values (
      ${input.lockKey},
      ${input.holder},
      now() + (${ttlSeconds}::int * interval '1 second'),
      now()
    )
    on conflict (lock_key)
    do update set
      holder = excluded.holder,
      locked_until = excluded.locked_until,
      updated_at = now()
    where public.job_locks.locked_until <= now()
    returning lock_key
  `;

  return rows.length > 0;
}

export async function releaseJobLock(input: {
  lockKey: string;
  holder: string;
}): Promise<void> {
  await assertJobLocksSchemaReady();
  await sql`
    update public.job_locks
    set
      locked_until = now(),
      updated_at = now()
    where lock_key = ${input.lockKey}
      and holder = ${input.holder}
  `;
}
