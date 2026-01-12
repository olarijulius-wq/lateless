// app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/app/lib/stripe';
import { auth } from '@/auth';

export async function POST() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedEmail = session.user.email.trim().toLowerCase();

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: 'Missing STRIPE_PRICE_ID' },
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],

      // seome kasutajaga emaili kaudu
      customer_email: normalizedEmail,
      metadata: {
        userEmail: normalizedEmail,
        userId: (session.user as { id?: string }).id ?? '',
      },
      subscription_data: {
        metadata: {
          userEmail: normalizedEmail,
          userId: (session.user as { id?: string }).id ?? '',
        },
      },

      success_url: `${baseUrl}/dashboard/settings?success=1`,
      cancel_url: `${baseUrl}/dashboard/settings?canceled=1`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Stripe error' },
      { status: 500 },
    );
  }
}
