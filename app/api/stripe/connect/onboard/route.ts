import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { stripe } from '@/app/lib/stripe';
import { requireUserEmail } from '@/app/lib/data';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function POST() {
  let userEmail = '';
  try {
    userEmail = await requireUserEmail();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');
  const payoutsUrl = `${baseUrl}/dashboard/settings/payouts`;

  try {
    const [user] = await sql<
      { id: string; stripe_connect_account_id: string | null }[]
    >`
      select id, stripe_connect_account_id
      from public.users
      where lower(email) = ${userEmail}
      limit 1
    `;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let accountId = user.stripe_connect_account_id ?? null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: userEmail,
      });
      accountId = account.id;

      await sql`
        update public.users
        set stripe_connect_account_id = ${accountId}
        where lower(email) = ${userEmail}
      `;
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: payoutsUrl,
      return_url: payoutsUrl,
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error('Error creating Stripe Connect onboarding link', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to start onboarding.' },
      { status: 500 },
    );
  }
}
