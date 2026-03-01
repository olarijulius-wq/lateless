import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import postgres from 'postgres';
import {
  fetchStripeConnectStatusForUser,
  requireUserEmail,
} from '@/app/lib/data';
import { getStripe } from '@/app/lib/stripe';
import {
  assertStripeConfig,
  createStripeRequestVerifier,
  normalizeStripeConfigError,
} from '@/app/lib/stripe-guard';
import { enforceRateLimit } from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function POST(request: Request) {
  let userEmail = '';
  try {
    userEmail = await requireUserEmail();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await enforceRateLimit(
    request,
    {
      bucket: 'stripe_connect_resync',
      windowSec: 300,
      ipLimit: 10,
      userLimit: 5,
    },
    { userKey: userEmail, failClosed: true },
  );
  if (rl) return rl;

  try {
    const stripe = getStripe();
    assertStripeConfig();

    const [user] = await sql<
      { id: string; stripe_connect_account_id: string | null }[]
    >`
      select id, stripe_connect_account_id
      from public.users
      where lower(email) = ${userEmail}
      limit 1
    `;

    const accountId = user?.stripe_connect_account_id?.trim() || null;
    if (!accountId) {
      return NextResponse.json(
        { error: 'No connected account found.' },
        { status: 400 },
      );
    }

    const verifier = createStripeRequestVerifier(stripe);
    const account = (await verifier.verifyConnectedAccountAccess(accountId)) as Stripe.Account;
    const connectAccountId = account.id;
    const payoutsEnabled = !!account.payouts_enabled;
    const detailsSubmitted = !!account.details_submitted;
    console.log('[connect resync] Stripe account status', {
      accountId: connectAccountId,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    });

    const updated = await sql`
      update public.users
      set
        stripe_connect_account_id = ${connectAccountId},
        stripe_connect_payouts_enabled = ${payoutsEnabled},
        stripe_connect_details_submitted = ${detailsSubmitted}
      where id = ${user?.id ?? null}
      returning id
    `;

    if (updated.length === 0) {
      console.warn('[connect resync] No user row updated', {
        accountId: connectAccountId,
        userEmail,
      });
    }

    const status = await fetchStripeConnectStatusForUser(userEmail);
    return NextResponse.json({ ok: true, status });
  } catch (err: unknown) {
    const normalized = normalizeStripeConfigError(err);
    console.error('Error resyncing Stripe Connect status', err);
    return NextResponse.json(
      {
        error: normalized.message ?? 'Failed to re-sync status from Stripe.',
        guidance: normalized.guidance,
        code: normalized.code,
      },
      { status: 500 },
    );
  }
}
