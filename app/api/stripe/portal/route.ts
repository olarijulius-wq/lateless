// app/api/stripe/portal/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/app/lib/stripe';
import { auth } from '@/auth';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = session.user.email.trim().toLowerCase();

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');

  // Võtame olemasoleva customer_id, kui on
  const rows = await sql<{ stripe_customer_id: string | null }[]>`
    select stripe_customer_id
    from public.users
    where lower(email) = ${email}
    limit 1
  `;

  let customerId = rows[0]?.stripe_customer_id ?? null;

  if (!customerId) {
    // Kui veel pole Stripe customer'it, loome
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;

    await sql`
      update public.users
      set stripe_customer_id = ${customerId}
      where lower(email) = ${email}
    `;
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/settings`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('Error creating billing portal session', err);
    return NextResponse.json(
      {
        error:
          err?.message ?? 'Failed to create billing portal session',
      },
      { status: 500 },
    );
  }
}