import 'server-only';

import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export type AppliedMigration = {
  filename: string;
  appliedAt: string;
};

export type MigrationReport = {
  migrationTableDetected: boolean;
  lastApplied: AppliedMigration | null;
  pending: number;
  pendingFilenames: string[];
};

export function listRepositoryMigrationFiles(): string[] {
  try {
    const migrationsDir = resolve(process.cwd(), 'migrations');
    return readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function getMigrationReport(): Promise<MigrationReport> {
  const repositoryMigrations = listRepositoryMigrationFiles();
  const [tableStatus] = await sql<{ has_schema_migrations: boolean }[]>`
    select to_regclass('public.schema_migrations') is not null as has_schema_migrations
  `;

  if (!tableStatus?.has_schema_migrations) {
    return {
      migrationTableDetected: false,
      lastApplied: null,
      pending: repositoryMigrations.length,
      pendingFilenames: repositoryMigrations,
    };
  }

  const appliedRows = await sql<{ filename: string; applied_at: Date }[]>`
    select filename, applied_at
    from public.schema_migrations
    order by applied_at desc, id desc
  `;

  const appliedSet = new Set(appliedRows.map((row) => row.filename));
  const pendingFilenames = repositoryMigrations.filter((filename) => !appliedSet.has(filename));
  const lastAppliedRow = appliedRows[0];

  return {
    migrationTableDetected: true,
    lastApplied: lastAppliedRow
      ? {
          filename: lastAppliedRow.filename,
          appliedAt: lastAppliedRow.applied_at.toISOString(),
        }
      : null,
    pending: pendingFilenames.length,
    pendingFilenames,
  };
}
