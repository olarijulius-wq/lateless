import { NextResponse } from 'next/server';
import { stripe } from '@/app/lib/stripe';
import { sql } from '@/app/lib/db';
import { resolveStripeWorkspaceBillingForInvoice } from '@/app/lib/invoice-workspace-billing';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  TEAM_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/workspaces';
import {
  assertRefundRequestsSchemaReady,
  isRefundRequestsMigrationRequiredError,
  REFUND_REQUESTS_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/refund-requests';
import { isStripePermissionOrNoAccessError } from '@/app/lib/stripe-connect';
import {
  enforceRateLimit,
  parseRouteParams,
  routeUuidParamsSchema,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const DEBUG = process.env.DEBUG_REFUNDS === 'true';
const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV === 'test' && process.env.LATELLESS_TEST_MODE === '1';
export const __testHooksEnabled = TEST_HOOKS_ENABLED;
export const __testHooks = {
  ensureWorkspaceContextForCurrentUserOverride: null as
    | (null | (() => Promise<{
      userEmail: string;
      workspaceId: string;
      userRole: 'owner' | 'admin' | 'member';
    }>)),
  enforceRateLimitOverride: null as
    | (null | ((req: Request, input: {
      bucket: string;
      windowSec: number;
      ipLimit: number;
      userLimit: number;
    }, opts: { userKey: string; failClosed: boolean }) => Promise<Response | null>)),
  paymentIntentRetrieveOverride: null as
    | (null | ((paymentIntentId: string, stripeAccount: string) => Promise<{
      latest_charge: string | { id: string } | null;
    }>)),
  refundCreateOverride: null as
    | (null | ((chargeId: string, stripeAccount: string, idempotencyKey: string) => Promise<{ id: string }>)),
  chargeRetrieveOverride: null as
    | (null | ((chargeId: string, stripeAccount: string) => Promise<{
      amount: number;
      amount_refunded: number;
      currency: string;
      refunds: {
        data: Array<{ id: string; created: number; amount: number }>;
      };
    }>)),
};

function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log(...args);
  }
}

function readChargeId(
  latestCharge: string | { id: string } | null | undefined,
): string | null {
  if (!latestCharge) return null;
  if (typeof latestCharge === 'string') return latestCharge;
  return typeof latestCharge.id === 'string' ? latestCharge.id : null;
}

function isChargeAlreadyRefundedError(error: unknown): boolean {
  const stripeError = error as {
    code?: string;
    raw?: { code?: string };
    message?: string;
  } | null;
  const code = stripeError?.code ?? stripeError?.raw?.code ?? null;
  const message = stripeError?.message ?? '';

  return code === 'charge_already_refunded' || /already refunded/i.test(message);
}

type ChargeRefundSnapshot = {
  amount: number;
  amountRefunded: number;
  currency: string | null;
  latestRefundId: string | null;
};

function readChargeRefundSnapshot(charge: {
  amount?: unknown;
  amount_refunded?: unknown;
  currency?: unknown;
  refunds?:
  | {
    data?: Array<{ id?: unknown; created?: unknown; amount?: unknown }>;
  }
  | null;
}): ChargeRefundSnapshot {
  const amount = typeof charge.amount === 'number' ? charge.amount : 0;
  const refunds = Array.isArray(charge.refunds?.data) ? charge.refunds.data : [];

  const refundsWithIds = refunds
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : null,
      created: typeof item.created === 'number' ? item.created : null,
      amount: typeof item.amount === 'number' ? item.amount : 0,
    }))
    .filter((item): item is { id: string; created: number | null; amount: number } =>
      Boolean(item.id),
    );

  const sortedRefunds = [...refundsWithIds].sort((a, b) => {
    const aCreated = a.created ?? 0;
    const bCreated = b.created ?? 0;
    return bCreated - aCreated;
  });

  const summedRefundAmount = refundsWithIds.reduce(
    (sum, refund) => sum + refund.amount,
    0,
  );

  const amountRefunded =
    typeof charge.amount_refunded === 'number'
      ? charge.amount_refunded
      : summedRefundAmount;
  const currency = typeof charge.currency === 'string' ? charge.currency : null;
  const latestRefundId = sortedRefunds[0]?.id ?? null;

  return {
    amount,
    amountRefunded,
    currency,
    latestRefundId,
  };
}

export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const rawParams = await props.params;
  const parsedParams = parseRouteParams(routeUuidParamsSchema, rawParams);
  if (!parsedParams.ok) return parsedParams.response;
  const requestId = parsedParams.data.id;

  try {
    await assertRefundRequestsSchemaReady();
    const context = TEST_HOOKS_ENABLED
      ? (__testHooks.ensureWorkspaceContextForCurrentUserOverride
        ? await __testHooks.ensureWorkspaceContextForCurrentUserOverride()
        : await ensureWorkspaceContextForCurrentUser())
      : await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only owners and admins can approve refunds.' },
        { status: 403 },
      );
    }

    const rl = TEST_HOOKS_ENABLED
      ? (__testHooks.enforceRateLimitOverride
        ? await __testHooks.enforceRateLimitOverride(
          _request,
          {
            bucket: 'refund_approve',
            windowSec: 300,
            ipLimit: 20,
            userLimit: 10,
          },
          {
            userKey: context.userEmail,
            failClosed: true,
          },
        )
        : await enforceRateLimit(
          _request,
          {
            bucket: 'refund_approve',
            windowSec: 300,
            ipLimit: 20,
            userLimit: 10,
          },
          {
            userKey: context.userEmail,
            failClosed: true,
          },
        ))
      : await enforceRateLimit(
        _request,
        {
          bucket: 'refund_approve',
          windowSec: 300,
          ipLimit: 20,
          userLimit: 10,
        },
        {
          userKey: context.userEmail,
          failClosed: true,
        },
      );
    if (rl) return rl;

    const [row] = await sql<{
      id: string;
      status: 'pending' | 'approved' | 'declined';
      invoice_id: string;
      invoice_status: string;
      stripe_payment_intent_id: string | null;
    }[]>`
      select
        rr.id,
        rr.status,
        rr.invoice_id,
        i.status as invoice_status,
        i.stripe_payment_intent_id
      from public.refund_requests rr
      join public.invoices i
        on i.id = rr.invoice_id
      where rr.id = ${requestId}
        and rr.workspace_id = ${context.workspaceId}
      limit 1
    `;

    if (!row) {
      return NextResponse.json(
        { ok: false, message: 'Refund request not found.' },
        { status: 404 },
      );
    }

    if (row.status !== 'pending') {
      return NextResponse.json(
        {
          ok: false,
          code: 'REFUND_REQUEST_ALREADY_RESOLVED',
          message: `Refund request is already ${row.status}.`,
        },
        { status: 409 },
      );
    }

    if (
      row.invoice_status !== 'paid' &&
      row.invoice_status !== 'partially_refunded' &&
      row.invoice_status !== 'refunded'
    ) {
      return NextResponse.json(
        { ok: false, message: 'Only paid invoices can be refunded from this action.' },
        { status: 409 },
      );
    }

    if (!row.stripe_payment_intent_id) {
      return NextResponse.json(
        { ok: false, message: 'Missing Stripe payment intent on invoice.' },
        { status: 409 },
      );
    }

    const invoiceBilling = await resolveStripeWorkspaceBillingForInvoice(row.invoice_id);
    if (!invoiceBilling || !invoiceBilling.workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          code: 'INVOICE_WORKSPACE_MISSING',
          message: 'Invoice workspace is missing; refund approval is blocked.',
        },
        { status: 409 },
      );
    }

    if (invoiceBilling.workspaceId.trim() !== context.workspaceId.trim()) {
      return NextResponse.json(
        { ok: false, message: 'Refund request not found.' },
        { status: 404 },
      );
    }

    if (!invoiceBilling.workspaceBillingExists) {
      return NextResponse.json(
        {
          ok: false,
          code: 'WORKSPACE_BILLING_MISSING',
          message: 'Workspace billing is not configured for this invoice workspace.',
        },
        { status: 409 },
      );
    }

    const stripeAccount = invoiceBilling.stripeAccountId;

    if (!stripeAccount) {
      return NextResponse.json(
        { ok: false, message: 'Connected Stripe account is not configured.' },
        { status: 409 },
      );
    }

    const intent = TEST_HOOKS_ENABLED && __testHooks.paymentIntentRetrieveOverride
      ? await __testHooks.paymentIntentRetrieveOverride(
        row.stripe_payment_intent_id,
        stripeAccount,
      )
      : await stripe.paymentIntents.retrieve(
        row.stripe_payment_intent_id,
        {},
        { stripeAccount },
      );
    const chargeId = readChargeId(intent.latest_charge);

    if (!chargeId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Stripe charge was not found on the payment intent.',
        },
        { status: 409 },
      );
    }

    let alreadyRefunded = false;
    let resolvedStripeRefundId: string | null = null;

    try {
      const idempotencyKey = `refund_request_${row.id}`;
      const refund = TEST_HOOKS_ENABLED && __testHooks.refundCreateOverride
        ? await __testHooks.refundCreateOverride(chargeId, stripeAccount, idempotencyKey)
        : await stripe.refunds.create(
          { charge: chargeId },
          {
            stripeAccount,
            idempotencyKey,
          },
        );
      resolvedStripeRefundId = refund.id;
    } catch (error) {
      if (!isChargeAlreadyRefundedError(error)) {
        throw error;
      }
      alreadyRefunded = true;
      console.warn(
        '[refund approve] charge already refunded, marking request approved with ids',
        {
          requestId: row.id,
          invoiceId: row.invoice_id,
          chargeId,
          stripeAccount,
        },
      );
    }

    const charge = TEST_HOOKS_ENABLED && __testHooks.chargeRetrieveOverride
      ? await __testHooks.chargeRetrieveOverride(chargeId, stripeAccount)
      : await stripe.charges.retrieve(
        chargeId,
        { expand: ['refunds'] },
        { stripeAccount },
      );
    const chargeSnapshot = readChargeRefundSnapshot(charge);
    const effectiveStripeRefundId =
      resolvedStripeRefundId ?? chargeSnapshot.latestRefundId;

    const isPartialRefund =
      chargeSnapshot.amount > 0 &&
      chargeSnapshot.amountRefunded > 0 &&
      chargeSnapshot.amountRefunded < chargeSnapshot.amount;
    const targetInvoiceStatus = isPartialRefund
      ? 'partially_refunded'
      : 'refunded';

    const approvalResult = await sql.begin(async (tx) => {
      const updated = (await tx.unsafe(
        `
        update public.refund_requests
        set
          status = 'approved',
          resolved_at = now(),
          resolved_by_user_email = $1,
          stripe_refund_id = $2
        where id = $3
          and status = 'pending'
        returning id
        `,
        [context.userEmail, effectiveStripeRefundId, row.id],
      )) as { id: string }[];

      if (updated.length === 0) {
        return { ok: false as const };
      }

      await tx.unsafe(
        `
        update public.invoices
        set
          status = case
            when status = 'refunded' then 'refunded'
            when $1 = 'refunded' then 'refunded'
            else 'partially_refunded'
          end,
          refunded_at = coalesce(refunded_at, now())
        where id = $2
          and status in ('paid', 'partially_refunded', 'refunded')
        `,
        [targetInvoiceStatus, row.invoice_id],
      );

      return { ok: true as const };
    });

    if (!approvalResult.ok) {
      return NextResponse.json(
        { ok: false, message: 'Refund request is no longer pending.' },
        { status: 409 },
      );
    }

    debugLog('[refund request] approved', {
      requestId: row.id,
      invoiceId: row.invoice_id,
      stripeRefundId: effectiveStripeRefundId,
      alreadyRefunded,
      chargeAmount: chargeSnapshot.amount,
      chargeAmountRefunded: chargeSnapshot.amountRefunded,
      chargeCurrency: chargeSnapshot.currency,
      stripeAccount,
    });

    if (alreadyRefunded) {
      return NextResponse.json({
        ok: true,
        alreadyRefunded: true,
        stripeRefundId: effectiveStripeRefundId,
      });
    }

    return NextResponse.json({ ok: true, stripeRefundId: effectiveStripeRefundId });
  } catch (error) {
    if (isTeamMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: TEAM_MIGRATION_REQUIRED_CODE,
          message:
            'Team requires DB migrations 007_add_workspaces_and_team.sql and 013_add_active_workspace_and_company_profile_workspace_scope.sql. Run migrations and retry.',
        },
        { status: 503 },
      );
    }

    if (isRefundRequestsMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: REFUND_REQUESTS_MIGRATION_REQUIRED_CODE,
          message: 'Refund requests require DB migration 019_add_refund_requests.sql.',
        },
        { status: 503 },
      );
    }

    if (isStripePermissionOrNoAccessError(error)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'Connected Stripe account cannot be accessed with the current API key mode.',
        },
        { status: 409 },
      );
    }

    console.error('Approve refund request failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to approve refund request.' },
      { status: 500 },
    );
  }
}
