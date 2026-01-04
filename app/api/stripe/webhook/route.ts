// app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import postgres from 'postgres';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature' },
      { status: 400 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Missing STRIPE_WEBHOOK_SECRET' },
      { status: 500 },
    );
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook signature verify failed: ${err?.message}` },
      { status: 400 },
    );
  }

  try {
    // 1) Checkout session -> seome kasutajaga emaili järgi
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const email =
        session.customer_email ||
        session.customer_details?.email ||
        session.metadata?.userEmail ||
        null;

      const customerId =
        typeof session.customer === 'string' ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : null;

      if (email) {
        await sql`
          update public.users
          set
            is_pro = true,
            stripe_customer_id = coalesce(${customerId}, stripe_customer_id),
            stripe_subscription_id = coalesce(${subscriptionId}, stripe_subscription_id),
            subscription_status = coalesce(subscription_status, 'active')
          where lower(email) = ${normalizeEmail(email)}
        `;
      }
    }

    // 2) Subscription loodud / uuendatud – siit tulevad kõige täpsemad andmed:
        // 2) Subscription loodud / uuendatud – siit tulevad kõige täpsemad andmed:
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const sub = event.data.object as Stripe.Subscription & {
        current_period_end?: number | null;
      };

      const customerId =
        typeof sub.customer === 'string' ? sub.customer : null;
      const subscriptionId = sub.id;
      const status = sub.status; // 'active', 'trialing', 'past_due', 'canceled', ...
      const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
      const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null;

      await sql`
        update public.users
        set
          stripe_customer_id = ${customerId},
          stripe_subscription_id = ${subscriptionId},
          subscription_status = ${status},
          cancel_at_period_end = ${cancelAtPeriodEnd},
          current_period_end = ${currentPeriodEnd},
          -- Variant B: Pro seni, kuni staatus on aktiivne / trial
          is_pro = ${
            status === 'active' || status === 'trialing' ? true : false
          }
        where
          stripe_subscription_id = ${subscriptionId}
          or stripe_customer_id = ${customerId}
      `;
    }

    // 3) Subscription päriselt kustutatud (näiteks kui on setitud "cancel immediately")
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === 'string' ? sub.customer : null;

      if (customerId) {
        await sql`
          update public.users
          set
            is_pro = false,
            subscription_status = 'canceled',
            cancel_at_period_end = false,
            current_period_end = null
          where stripe_customer_id = ${customerId}
        `;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Webhook handler error' },
      { status: 500 },
    );
  }
}