#!/usr/bin/env bash
set -euo pipefail

node --experimental-strip-types <<'NODE'
import { PLAN_IDS, PLAN_CONFIG } from './app/lib/config.ts';
import { computeInvoiceFeeBreakdown } from './app/lib/pricing-fees.ts';

const baseAmount = 10000;
console.log(`Base amount: ${baseAmount} cents (€${(baseAmount / 100).toFixed(2)})`);

for (const planId of PLAN_IDS) {
  const plan = PLAN_CONFIG[planId];
  const breakdown = computeInvoiceFeeBreakdown(baseAmount, false, planId);
  console.log(
    `${plan.name}: ${breakdown.platformFeeAmount} cents (€${(breakdown.platformFeeAmount / 100).toFixed(2)})` +
      ` | fixed=${plan.platformFeeFixedCents}c percent=${plan.platformFeePercent}% cap=${plan.platformFeeCapCents}c`,
  );
}
NODE
