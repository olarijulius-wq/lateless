import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { getStripe } from '@/app/lib/stripe';
import { requireUserEmail } from '@/app/lib/data';
import {
  assertStripeConfig,
  normalizeStripeConfigError,
} from '@/app/lib/stripe-guard';
import { enforceRateLimit } from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function GET(request: Request) {
  let userEmail = '';
  try {
    userEmail = await requireUserEmail();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await enforceRateLimit(
    request,
    {
      bucket: 'stripe_connect_login',
      windowSec: 300,
      ipLimit: 20,
      userLimit: 10,
    },
    { userKey: userEmail, failClosed: true },
  );
  if (rl) return rl;

  try {
    const stripe = getStripe();
    assertStripeConfig();

    const [user] = await sql<{ stripe_connect_account_id: string | null }[]>`
      select stripe_connect_account_id
      from public.users
      where lower(email) = ${userEmail}
      limit 1
    `;

    const accountId = user?.stripe_connect_account_id ?? null;

    if (!accountId) {
      return NextResponse.json(
        { error: 'No connected account' },
        { status: 400 },
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(accountId);
    return NextResponse.redirect(loginLink.url);
  } catch (err: unknown) {
    const normalized = normalizeStripeConfigError(err);
    console.error('Error creating Stripe Connect login link', err);
    return NextResponse.json(
      {
        error: normalized.message ?? 'Failed to create Stripe Connect login link.',
        guidance: normalized.guidance,
        code: normalized.code,
      },
      { status: 500 },
    );
  }
}
