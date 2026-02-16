#!/usr/bin/env bash
set -euo pipefail

node --experimental-strip-types <<'NODE'
import assert from 'node:assert/strict';
import { computeInvoiceFeeBreakdown } from './app/lib/pricing-fees.ts';

const scenarios = [100, 9900, 100000];

for (const baseAmount of scenarios) {
  const withUplift = computeInvoiceFeeBreakdown(baseAmount, true);
  const withoutUplift = computeInvoiceFeeBreakdown(baseAmount, false);

  assert.equal(withUplift.baseAmount, baseAmount);
  assert.equal(withUplift.payableAmount, withUplift.baseAmount + withUplift.processingUpliftAmount);
  assert.ok(withUplift.processingUpliftAmount >= 0);
  assert.ok(withUplift.platformFeeAmount >= 0);
  assert.equal(withUplift.merchantNetAmount, Math.max(0, baseAmount - withUplift.platformFeeAmount));

  assert.equal(withoutUplift.processingUpliftAmount, 0);
  assert.equal(withoutUplift.payableAmount, baseAmount);

  // Platform fee must stay based on base amount (not payable amount).
  assert.equal(withUplift.platformFeeAmount, withoutUplift.platformFeeAmount);
}
NODE

echo "[fee-breakdown] all checks passed"
