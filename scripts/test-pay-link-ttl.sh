#!/usr/bin/env bash
set -euo pipefail

echo "[pay-link] test: dev default TTL includes exp and verifies"
NODE_ENV=development PAY_LINK_SECRET=test-secret PAY_LINK_TTL_SECONDS= node --experimental-strip-types <<'NODE'
import assert from 'node:assert/strict';
import { generatePayToken, verifyPayToken } from './app/lib/pay-link.ts';

const token = generatePayToken('inv_dev');
const result = verifyPayToken(token);
assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(typeof result.payload.iat, 'number');
  assert.equal(typeof result.payload.exp, 'number');
  assert.ok((result.payload.exp ?? 0) > (result.payload.iat ?? 0));
}
NODE

echo "[pay-link] test: production defaults to 90 days when PAY_LINK_TTL_SECONDS is missing"
NODE_ENV=production PAY_LINK_SECRET=test-secret PAY_LINK_TTL_SECONDS= node --experimental-strip-types <<'NODE'
import assert from 'node:assert/strict';
import { generatePayToken, verifyPayToken } from './app/lib/pay-link.ts';

const token = generatePayToken('inv_prod_missing_ttl');
const result = verifyPayToken(token);
assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(typeof result.payload.iat, 'number');
  assert.equal(typeof result.payload.exp, 'number');
  const ttl = (result.payload.exp ?? 0) - (result.payload.iat ?? 0);
  assert.equal(ttl, 90 * 24 * 60 * 60);
}
NODE

echo "[pay-link] test: production falls back to 90 days on invalid PAY_LINK_TTL_SECONDS"
NODE_ENV=production PAY_LINK_SECRET=test-secret PAY_LINK_TTL_SECONDS=invalid node --experimental-strip-types <<'NODE'
import assert from 'node:assert/strict';
import { generatePayToken, verifyPayToken } from './app/lib/pay-link.ts';

const token = generatePayToken('inv_prod_invalid_ttl');
const result = verifyPayToken(token);
assert.equal(result.ok, true);
if (result.ok) {
  const ttl = (result.payload.exp ?? 0) - (result.payload.iat ?? 0);
  assert.equal(ttl, 90 * 24 * 60 * 60);
}
NODE

echo "[pay-link] all checks passed"
