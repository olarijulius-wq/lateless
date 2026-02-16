#!/usr/bin/env bash
set -euo pipefail

: "${INVOICE_AMOUNT_CENTS:?INVOICE_AMOUNT_CENTS is required}"
: "${PLAN_ID:?PLAN_ID is required (free|solo|pro|studio)}"
PROCESSING_UPLIFT_ENABLED="${PROCESSING_UPLIFT_ENABLED:-true}"

node --experimental-strip-types <<'NODE'
import { PLAN_IDS } from './app/lib/config.ts';
import { computeInvoiceFeeBreakdown } from './app/lib/pricing-fees.ts';

const amount = Number(process.env.INVOICE_AMOUNT_CENTS);
const planId = String(process.env.PLAN_ID);
const processingUpliftEnabled =
  String(process.env.PROCESSING_UPLIFT_ENABLED ?? 'true').toLowerCase() === 'true';

if (!Number.isInteger(amount) || amount < 0) {
  throw new Error('INVOICE_AMOUNT_CENTS must be a non-negative integer');
}
if (!PLAN_IDS.includes(planId as (typeof PLAN_IDS)[number])) {
  throw new Error('PLAN_ID must be one of: free, solo, pro, studio');
}

const breakdown = computeInvoiceFeeBreakdown(
  amount,
  processingUpliftEnabled,
  planId as (typeof PLAN_IDS)[number],
);

const STRIPE_FEE_LOW_PCT = 0.029;
const STRIPE_FEE_LOW_FIXED = 30;
const STRIPE_FEE_HIGH_PCT = 0.039;
const STRIPE_FEE_HIGH_FIXED = 50;

const payerTotal = breakdown.payableAmount;
const stripeFeeLow = Math.round(payerTotal * STRIPE_FEE_LOW_PCT) + STRIPE_FEE_LOW_FIXED;
const stripeFeeHigh = Math.round(payerTotal * STRIPE_FEE_HIGH_PCT) + STRIPE_FEE_HIGH_FIXED;
const estimatedMerchantLow = Math.max(
  0,
  payerTotal - stripeFeeHigh - breakdown.platformFeeAmount,
);
const estimatedMerchantHigh = Math.max(
  0,
  payerTotal - stripeFeeLow - breakdown.platformFeeAmount,
);

console.log(JSON.stringify({
  input: {
    planId,
    invoiceAmountCents: amount,
    processingUpliftEnabled,
  },
  breakdown,
  estimatedRange: {
    merchantTakeHomeLowCents: estimatedMerchantLow,
    merchantTakeHomeHighCents: estimatedMerchantHigh,
  },
}, null, 2));
NODE
