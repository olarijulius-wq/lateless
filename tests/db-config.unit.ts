import assert from 'node:assert/strict';
import {
  resolveDbConnectionConfig,
  resolveDbConnectionCandidates,
  resolvePoolMaxForRuntime,
  resolveDbSourcePriority,
} from '@/app/lib/db';
import {
  resolveMigrationConnectionConfig,
  resolveMigrationSourceEnvVar,
} from '@/scripts/migrate.mjs';

const ORIGINAL_ENV = { ...process.env };
const mutableEnv = process.env as Record<string, string | undefined>;

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
}

function run() {
  resetEnv();
  mutableEnv.NODE_ENV = 'development';
  mutableEnv.LATELLESS_TEST_MODE = '0';
  delete mutableEnv.POSTGRES_URL_TEST;
  mutableEnv.POSTGRES_URL_POOLER = 'postgres://u:p@pooler.local:6543/db';
  mutableEnv.POSTGRES_URL_NON_POOLING = 'postgres://u:p@direct-nonpool.local:5432/db';
  mutableEnv.POSTGRES_URL_DIRECT = 'postgres://u:p@direct-explicit.local:5432/db';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@direct.local:5432/db';
  mutableEnv.DATABASE_URL = 'postgres://u:p@fallback.local:5432/db';
  assert.deepEqual(resolveDbSourcePriority(), [
    'POSTGRES_URL_POOLER',
    'POSTGRES_URL_NON_POOLING',
    'POSTGRES_URL_DIRECT',
    'POSTGRES_URL',
    'DATABASE_URL',
  ]);

  resetEnv();
  mutableEnv.NODE_ENV = 'test';
  mutableEnv.POSTGRES_URL_TEST = 'postgres://u:p@test.local:5432/db';
  mutableEnv.POSTGRES_URL_POOLER = 'postgres://u:p@pooler.local:6543/db';
  mutableEnv.POSTGRES_URL_NON_POOLING = 'postgres://u:p@direct-nonpool.local:5432/db';
  mutableEnv.POSTGRES_URL_DIRECT = 'postgres://u:p@direct-explicit.local:5432/db';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@direct.local:5432/db';
  mutableEnv.DATABASE_URL = 'postgres://u:p@fallback.local:5432/db';
  const candidates = resolveDbConnectionCandidates();
  assert.equal(candidates[0]?.sourceEnvVar, 'POSTGRES_URL_TEST');
  assert.equal(candidates.length, 1);

  resetEnv();
  mutableEnv.NODE_ENV = 'production';
  mutableEnv.LATELLESS_TEST_MODE = '0';
  delete mutableEnv.POSTGRES_URL_TEST;
  mutableEnv.POSTGRES_URL_POOLER = 'postgres://u:p@pooler.local:6543/db';
  mutableEnv.POSTGRES_URL_NON_POOLING = 'postgres://u:p@direct-nonpool.local:5432/db';
  mutableEnv.POSTGRES_URL_DIRECT = 'postgres://u:p@direct-explicit.local:5432/db';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@direct.local:5432/db';
  mutableEnv.DATABASE_URL = 'postgres://u:p@fallback.local:5432/db';
  assert.deepEqual(resolveDbSourcePriority(), [
    'POSTGRES_URL_POOLER',
    'POSTGRES_URL',
    'DATABASE_URL',
  ]);

  resetEnv();
  mutableEnv.NODE_ENV = 'production';
  mutableEnv.LATELLESS_TEST_MODE = '0';
  delete mutableEnv.POSTGRES_URL_TEST;
  mutableEnv.POSTGRES_URL_POOLER = 'postgres://u:p@pooler.local:6543/db';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@direct.local:5432/db';
  mutableEnv.DATABASE_URL = 'postgres://u:p@fallback.local:5432/db';
  mutableEnv.POSTGRES_POOL_MAX = '8';
  const productionCandidates = resolveDbConnectionCandidates();
  assert.equal(productionCandidates[0]?.sourceEnvVar, 'POSTGRES_URL_POOLER');
  assert.equal(resolveDbConnectionConfig().poolMax, 2);
  assert.equal(resolvePoolMaxForRuntime(), 2);

  resetEnv();
  mutableEnv.NODE_ENV = 'production';
  mutableEnv.LATELLESS_TEST_MODE = '0';
  delete mutableEnv.POSTGRES_URL_TEST;
  mutableEnv.POSTGRES_URL_NON_POOLING = 'postgres://u:p@direct-nonpool.local:5432/db';
  mutableEnv.POSTGRES_URL_DIRECT = 'postgres://u:p@direct-explicit.local:5432/db';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@direct.local:5432/db';
  mutableEnv.DATABASE_URL = 'postgres://u:p@fallback.local:5432/db';
  assert.equal(
    resolveMigrationSourceEnvVar(),
    'POSTGRES_URL_NON_POOLING',
  );

  delete mutableEnv.POSTGRES_URL_NON_POOLING;
  assert.equal(resolveMigrationSourceEnvVar(), 'POSTGRES_URL_DIRECT');

  delete mutableEnv.POSTGRES_URL_DIRECT;
  assert.equal(resolveMigrationSourceEnvVar(), 'POSTGRES_URL');

  resetEnv();
  mutableEnv.NODE_ENV = 'production';
  mutableEnv.POSTGRES_URL_NON_POOLING = 'postgres://u:p@pooler.local:6543/db';
  assert.throws(
    () => resolveMigrationConnectionConfig(),
    /Migrations cannot use pooler URLs/i,
  );

  mutableEnv.ALLOW_PROD_DB = '1';
  const allowedPoolerMigrationConfig = resolveMigrationConnectionConfig();
  assert.equal(allowedPoolerMigrationConfig.sourceEnvVar, 'POSTGRES_URL_NON_POOLING');

  resetEnv();
  mutableEnv.NODE_ENV = 'test';
  delete mutableEnv.POSTGRES_URL_TEST;
  assert.throws(
    () => resolveDbConnectionCandidates(),
    /requires POSTGRES_URL_TEST/i,
  );

  resetEnv();
  mutableEnv.CI = 'true';
  delete mutableEnv.POSTGRES_URL_TEST;
  assert.throws(
    () => resolveDbConnectionCandidates(),
    /requires POSTGRES_URL_TEST/i,
  );

  resetEnv();
  mutableEnv.GITHUB_ACTIONS = 'true';
  delete mutableEnv.POSTGRES_URL_TEST;
  assert.throws(
    () => resolveDbConnectionCandidates(),
    /requires POSTGRES_URL_TEST/i,
  );

  resetEnv();
  mutableEnv.NODE_ENV = 'test';
  mutableEnv.POSTGRES_URL_TEST = 'postgres://u:p@shared.local:5432/db';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@shared.local:5432/db';
  assert.throws(
    () => resolveDbConnectionCandidates(),
    /matches POSTGRES_URL/i,
  );

  resetEnv();
  mutableEnv.NODE_ENV = 'test';
  mutableEnv.POSTGRES_URL_TEST = 'postgres://u:p@shared.local:5432/db';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@shared.local:5432/db';
  mutableEnv.ALLOW_PROD_DB = '1';
  const allowOverrideCandidates = resolveDbConnectionCandidates();
  assert.equal(allowOverrideCandidates[0]?.sourceEnvVar, 'POSTGRES_URL_TEST');

  resetEnv();
  mutableEnv.GITHUB_ACTIONS = 'true';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@direct.local:5432/db';
  delete mutableEnv.POSTGRES_URL_TEST;
  assert.throws(
    () => resolveMigrationSourceEnvVar(),
    /requires POSTGRES_URL_TEST/i,
  );
}

run();
console.log('[db-config.unit] passed');
