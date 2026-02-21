#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  console.error('Missing DATABASE_URL or POSTGRES_URL.');
  process.exit(1);
}

const dryRun = process.env.DRY_RUN === '1';
const actorEmail = (process.env.MIGRATION_ACTOR_EMAIL || process.env.ACTOR_EMAIL || '').trim() || null;
const appVersion =
  (process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || '')
    .trim() || null;

const sql = postgres(dbUrl, { ssl: 'require' });
const migrationsDir = resolve(process.cwd(), 'migrations');

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function listMigrationFiles() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
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

async function main() {
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
