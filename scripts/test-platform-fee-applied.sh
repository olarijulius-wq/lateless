#!/usr/bin/env bash
set -euo pipefail

# Validates the latest paid invoice against Stripe:
# - payment_intent.amount equals invoices.payable_amount
# - application_fee_amount equals platform fee computed from invoices.amount (base amount)
#
# Required env vars:
# - INVOICE_ID
# - POSTGRES_URL
# - STRIPE_SECRET_KEY

required_vars=(
  INVOICE_ID
  POSTGRES_URL
  STRIPE_SECRET_KEY
)

for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "missing env var: $name" >&2
    exit 1
  fi
done

node --experimental-strip-types <<'NODE'
import assert from 'node:assert/strict';
import postgres from 'postgres';
import Stripe from 'stripe';
import { computeInvoiceFeeBreakdown } from './app/lib/pricing-fees.ts';
import { resolveEffectivePlan } from './app/lib/config.ts';

const invoiceId = process.env.INVOICE_ID;
if (!invoiceId) throw new Error('INVOICE_ID is required');

const sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const rows = await sql`
  select
    i.id,
    i.amount,
    i.payable_amount,
    i.stripe_payment_intent_id,
    i.user_email,
    u.stripe_connect_account_id,
    u.plan,
    u.subscription_status
  from public.invoices i
  left join public.users u
    on lower(u.email) = lower(i.user_email)
  where i.id = ${invoiceId}
  limit 1
`;

const invoice = rows[0];
assert.ok(invoice, 'invoice not found');
assert.ok(invoice.stripe_payment_intent_id, 'invoice missing stripe_payment_intent_id');

const effectivePlan = resolveEffectivePlan(invoice.plan, invoice.subscription_status);
const expected = computeInvoiceFeeBreakdown(
  invoice.amount,
  (invoice.payable_amount ?? invoice.amount) > invoice.amount,
  effectivePlan,
);
const stripeAccount = invoice.stripe_connect_account_id?.trim() || null;
const intent = await stripe.paymentIntents.retrieve(
  invoice.stripe_payment_intent_id,
  {},
  stripeAccount ? { stripeAccount } : undefined,
);

assert.equal(intent.amount, invoice.payable_amount ?? invoice.amount, 'Stripe amount must equal payable amount');

if (stripeAccount) {
  assert.equal(
    intent.application_fee_amount ?? 0,
    expected.platformFeeAmount,
    'application_fee_amount mismatch',
  );
}

await sql.end({ timeout: 1 });
NODE

echo "[platform-fee] checks passed"
