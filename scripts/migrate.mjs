#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

const dryRun = process.env.DRY_RUN === '1';
const allowBaseline = process.env.ALLOW_BASELINE === '1';
const forceBaseline = process.env.FORCE_BASELINE === '1';
const actorEmail = (process.env.MIGRATION_ACTOR_EMAIL || process.env.ACTOR_EMAIL || '').trim() || null;
const appVersion =
  (process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || '')
    .trim() || null;

const migrationsDir = resolve(process.cwd(), 'migrations');

function resolveHostname(connectionString) {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
}

function resolveDbName(connectionString) {
  try {
    return new URL(connectionString).pathname.replace(/^\/+/, '') || '(none)';
  } catch {
    return 'unknown';
  }
}

function isTruthy(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isAllowProdDbOverrideEnabled() {
  return process.env.ALLOW_PROD_DB === '1';
}

let hasLoggedProdOverride = false;

function logProdOverrideOnce(reason) {
  if (hasLoggedProdOverride) return;
  hasLoggedProdOverride = true;
  console.error(`[migrate][override] ALLOW_PROD_DB=1 ${reason}`);
}

function throwGuardrail(message) {
  throw new Error(`[migrate][guardrail] ${message}`);
}

function shouldDisableSsl(connectionString) {
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') return true;
  if (process.env.LATELLESS_TEST_MODE === '1') return true;
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.PGSSLMODE?.toLowerCase() === 'disable') return true;

  const hostname = resolveHostname(connectionString);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function sanitizeConnectionStringForNoSsl(connectionString) {
  try {
    const parsed = new URL(connectionString);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('ssl');
    parsed.searchParams.delete('sslrootcert');
    parsed.searchParams.delete('sslcert');
    parsed.searchParams.delete('sslkey');
    parsed.searchParams.delete('sslpassword');
    parsed.searchParams.delete('options');
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

function resolveConnectionString() {
  const strictTestMode = process.env.NODE_ENV === 'test' || process.env.CI === 'true';
  const latentTestMode = process.env.LATELLESS_TEST_MODE === '1';
  const isTestMode = strictTestMode || latentTestMode;

  let sourceEnvVar;
  if (isTestMode) {
    if (!isTruthy(process.env.POSTGRES_URL_TEST)) {
      throwGuardrail(
        `NODE_ENV=${process.env.NODE_ENV ?? ''} CI=${process.env.CI ?? ''} requires POSTGRES_URL_TEST. Refusing fallback to POSTGRES_URL/DATABASE_URL.`,
      );
    }
    sourceEnvVar = 'POSTGRES_URL_TEST';
  } else if (process.env.NODE_ENV === 'production') {
    if (isTruthy(process.env.POSTGRES_URL_NON_POOLING)) {
      sourceEnvVar = 'POSTGRES_URL_NON_POOLING';
    } else if (isTruthy(process.env.POSTGRES_URL_DIRECT)) {
      sourceEnvVar = 'POSTGRES_URL_DIRECT';
    } else if (isTruthy(process.env.POSTGRES_URL)) {
      sourceEnvVar = 'POSTGRES_URL';
    } else {
      sourceEnvVar = 'DATABASE_URL';
    }
  } else {
    sourceEnvVar = process.env.POSTGRES_URL ? 'POSTGRES_URL' : 'DATABASE_URL';
  }

  const connectionStringRaw = process.env[sourceEnvVar];
  if (!connectionStringRaw) {
    throw new Error(
      'Missing POSTGRES_URL_TEST, POSTGRES_URL_NON_POOLING, POSTGRES_URL_DIRECT, POSTGRES_URL, or DATABASE_URL',
    );
  }

  const selectedHost = resolveHostname(connectionStringRaw);
  const selectedDb = resolveDbName(connectionStringRaw);
  const allowProdDb = isAllowProdDbOverrideEnabled();

  if (strictTestMode) {
    const collisionSources = [
      'POSTGRES_URL',
      'POSTGRES_URL_POOLER',
      'DATABASE_URL',
      'POSTGRES_URL_NON_POOLING',
      'POSTGRES_URL_DIRECT',
    ];
    for (const envVar of collisionSources) {
      const collisionRaw = process.env[envVar];
      if (!isTruthy(collisionRaw)) continue;
      const collisionHost = resolveHostname(collisionRaw);
      const collisionDb = resolveDbName(collisionRaw);
      if (collisionHost === selectedHost && collisionDb === selectedDb) {
        if (allowProdDb) {
          logProdOverrideOnce(
            `enabled in test/CI for shared target host=${selectedHost} db=${selectedDb} chosen=${sourceEnvVar} collides_with=${envVar}.`,
          );
          continue;
        }
        throwGuardrail(
          `POSTGRES_URL_TEST target host=${selectedHost} db=${selectedDb} matches ${envVar}. Set a dedicated test database or use ALLOW_PROD_DB=1 for explicit admin operations. chosen=${sourceEnvVar}.`,
        );
      }
    }
  }

  if (process.env.NODE_ENV === 'production' && isPoolerUrl(connectionStringRaw)) {
    if (!allowProdDb) {
      throwGuardrail(
        `Production migrations cannot use pooler URLs. chosen=${sourceEnvVar} host=${selectedHost} db=${selectedDb}. Use POSTGRES_URL_NON_POOLING or POSTGRES_URL_DIRECT.`,
      );
    }
    logProdOverrideOnce(
      `enabled in production while using pooler URL chosen=${sourceEnvVar} host=${selectedHost} db=${selectedDb}.`,
    );
  }

  const sslOff = shouldDisableSsl(connectionStringRaw);
  const connectionString = sslOff
    ? sanitizeConnectionStringForNoSsl(connectionStringRaw)
    : connectionStringRaw;

  return {
    connectionString,
    ssl: sslOff ? false : true,
    sourceEnvVar,
  };
}

function isPoolerUrl(connectionString) {
  try {
    const parsed = new URL(connectionString);
    return (
      parsed.hostname.toLowerCase().includes('pooler') ||
      parsed.port === '6543'
    );
  } catch {
    return false;
  }
}

const db = resolveConnectionString();
console.error(
  `[migrate][db] env=${process.env.NODE_ENV ?? ''} ci=${process.env.CI ?? ''} gha=${process.env.GITHUB_ACTIONS ?? ''} test_mode=${process.env.LATELLESS_TEST_MODE ?? ''} source=${db.sourceEnvVar} host=${resolveHostname(db.connectionString)} ssl=${String(db.ssl)}`,
);
const sql = postgres(db.connectionString, { ssl: db.ssl, connect_timeout: 15 });

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function listMigrationFiles() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

function parseCliArgs(argv) {
  let baseline = false;
  let baselineFrom = null;

  for (const arg of argv) {
    if (arg === '--baseline') {
      baseline = true;
      continue;
    }
    if (arg.startsWith('--baseline-from=')) {
      baseline = true;
      baselineFrom = arg.slice('--baseline-from='.length).trim() || null;
    }
  }

  return { baseline, baselineFrom };
}

async function ensureTrackingTable() {
  await sql`
    create table if not exists public.schema_migrations (
      id bigserial primary key,
      filename text unique not null,
      applied_at timestamptz not null default now(),
      checksum text null,
      actor_email text null,
      app_version text null
    )
  `;
  await sql`
    create index if not exists schema_migrations_applied_at_idx
      on public.schema_migrations (applied_at desc)
  `;
}

async function isLikelyEmptyDatabase() {
  const rows = await sql`
    select
      to_regclass('public.users')::text as users_table,
      to_regclass('public.invoices')::text as invoices_table
  `;
  const row = rows[0];
  return !row?.users_table && !row?.invoices_table;
}

async function runBaseline({ baselineFrom }) {
  if (!allowBaseline) {
    console.error(
      'Refusing baseline: set ALLOW_BASELINE=1 to enable --baseline mode. No migrations were executed.',
    );
    process.exitCode = 1;
    return;
  }

  await ensureTrackingTable();

  const files = listMigrationFiles().filter((filename) =>
    baselineFrom ? filename.localeCompare(baselineFrom) >= 0 : true,
  );
  const appliedRows = await sql`select filename, checksum from public.schema_migrations`;
  const appliedByFilename = new Map(appliedRows.map((row) => [row.filename, row.checksum]));

  if (appliedRows.length === 0) {
    const likelyEmptyDb = await isLikelyEmptyDatabase();
    if (likelyEmptyDb && !forceBaseline) {
      console.error(
        'Refusing baseline: schema_migrations is empty and core tables (public.users/public.invoices) were not found. Set FORCE_BASELINE=1 to override.',
      );
      process.exitCode = 1;
      return;
    }
    if (likelyEmptyDb && forceBaseline) {
      console.warn(
        'FORCE_BASELINE=1 set: proceeding even though schema_migrations is empty and core tables were not detected.',
      );
    }
  }

  let insertedCount = 0;
  let skippedCount = 0;
  const insertedFilenames = [];

  for (const filename of files) {
    const fullPath = resolve(migrationsDir, filename);
    const content = readFileSync(fullPath, 'utf8');
    const checksum = sha256(content);
    const existingChecksum = appliedByFilename.get(filename);

    if (existingChecksum !== undefined) {
      if (existingChecksum && existingChecksum !== checksum) {
        throw new Error(`Checksum mismatch for applied migration: ${filename}`);
      }
      skippedCount += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] baseline insert ${filename}`);
      insertedCount += 1;
      insertedFilenames.push(filename);
      continue;
    }

    await sql`
      insert into public.schema_migrations (filename, checksum, actor_email, app_version, applied_at)
      values (${filename}, ${checksum}, ${actorEmail}, ${appVersion}, now())
    `;
    insertedCount += 1;
    insertedFilenames.push(filename);
  }

  const firstInserted = insertedFilenames[0] ?? 'none';
  const lastInserted = insertedFilenames[insertedFilenames.length - 1] ?? 'none';
  console.log(`Baseline complete. Inserted=${insertedCount}, skipped=${skippedCount}, total=${files.length}`);
  console.log(`Inserted range: first=${firstInserted}, last=${lastInserted}`);
}

async function main() {
  const { baseline, baselineFrom } = parseCliArgs(process.argv.slice(2));
  if (baseline) {
    await runBaseline({ baselineFrom });
    return;
  }

  await ensureTrackingTable();

  const files = listMigrationFiles();
  const appliedRows = await sql`select filename, checksum from public.schema_migrations`;
  const appliedByFilename = new Map(appliedRows.map((row) => [row.filename, row.checksum]));

  let appliedCount = 0;
  let skippedCount = 0;

  for (const filename of files) {
    const fullPath = resolve(migrationsDir, filename);
    const content = readFileSync(fullPath, 'utf8');
    const checksum = sha256(content);
    const existingChecksum = appliedByFilename.get(filename);

    if (existingChecksum !== undefined) {
      if (existingChecksum && existingChecksum !== checksum) {
        throw new Error(`Checksum mismatch for applied migration: ${filename}`);
      }
      skippedCount += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] pending ${filename}`);
      continue;
    }

    console.log(`Applying ${filename}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`
        insert into public.schema_migrations (filename, checksum, actor_email, app_version)
        values (${filename}, ${checksum}, ${actorEmail}, ${appVersion})
      `;
    });
    appliedCount += 1;
  }

  console.log(
    dryRun
      ? `Dry run complete. Pending=${files.length - skippedCount}.`
      : `Migration apply complete. Applied=${appliedCount}, skipped=${skippedCount}.`,
  );
}

main()
  .catch((error) => {
    console.error('Migration run failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
