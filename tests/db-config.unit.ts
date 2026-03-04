import assert from 'node:assert/strict';
import {
  resolveDbConnectionCandidates,
  resolveDbSourcePriority,
} from '@/app/lib/db';

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
  mutableEnv.POSTGRES_URL_POOLER = 'postgres://u:p@pooler.local:6543/db';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@direct.local:5432/db';
  mutableEnv.DATABASE_URL = 'postgres://u:p@fallback.local:5432/db';
  assert.deepEqual(resolveDbSourcePriority(), [
    'POSTGRES_URL_POOLER',
    'POSTGRES_URL',
    'DATABASE_URL',
  ]);

  resetEnv();
  mutableEnv.NODE_ENV = 'test';
  mutableEnv.POSTGRES_URL_TEST = 'postgres://u:p@test.local:5432/db';
  mutableEnv.POSTGRES_URL_POOLER = 'postgres://u:p@pooler.local:6543/db';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@direct.local:5432/db';
  mutableEnv.DATABASE_URL = 'postgres://u:p@fallback.local:5432/db';
  const candidates = resolveDbConnectionCandidates();
  assert.equal(candidates[0]?.sourceEnvVar, 'POSTGRES_URL_TEST');
  assert.equal(candidates[1]?.sourceEnvVar, 'POSTGRES_URL_POOLER');
  assert.equal(candidates[2]?.sourceEnvVar, 'POSTGRES_URL');
  assert.equal(candidates[3]?.sourceEnvVar, 'DATABASE_URL');

  resetEnv();
  mutableEnv.NODE_ENV = 'production';
  mutableEnv.POSTGRES_URL_POOLER = 'postgres://u:p@pooler.local:6543/db';
  mutableEnv.POSTGRES_URL = 'postgres://u:p@direct.local:5432/db';
  mutableEnv.DATABASE_URL = 'postgres://u:p@fallback.local:5432/db';
  assert.deepEqual(resolveDbSourcePriority(), ['POSTGRES_URL', 'DATABASE_URL']);
}

run();
console.log('[db-config.unit] passed');
