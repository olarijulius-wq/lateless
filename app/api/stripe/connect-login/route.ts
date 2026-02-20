import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { stripe } from '@/app/lib/stripe';
import { requireUserEmail } from '@/app/lib/data';
import {
  assertStripeConfig,
  normalizeStripeConfigError,
} from '@/app/lib/stripe-guard';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function GET() {
  let userEmail = '';
  try {
    userEmail = await requireUserEmail();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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
