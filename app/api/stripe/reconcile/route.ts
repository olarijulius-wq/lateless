import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import postgres from 'postgres';
import { z } from 'zod';
import { auth } from '@/auth';
import { stripe } from '@/app/lib/stripe';
import { resolvePaidPlanFromStripe } from '@/app/lib/config';
import { ensureWorkspaceContextForCurrentUser } from '@/app/lib/workspaces';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const reconcileSchema = z
  .object({
    sessionId: z.string().trim().min(1).optional(),
    subscriptionId: z.string().trim().min(1).optional(),
  })
  .refine((value) => Boolean(value.sessionId || value.subscriptionId), {
    message: 'sessionId or subscriptionId is required',
  });

function parseStripeId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const candidate = value as { id?: unknown };
  return typeof candidate.id === 'string' ? candidate.id : null;
}

function readProductPlan(
  product: Stripe.Price['product'] | null | undefined,
): string | null {
  if (!product || typeof product === 'string') return null;
  if ('deleted' in product && product.deleted) return null;
  return product.metadata?.plan ?? null;
}

type WorkspaceBillingColumns = {
  hasPlan: boolean;
  hasStripeCustomerId: boolean;
  hasStripeSubscriptionId: boolean;
  hasSubscriptionStatus: boolean;
};

async function readWorkspaceBillingColumns(tx: any): Promise<WorkspaceBillingColumns> {
  const rows = (await tx.unsafe(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'workspaces'
        and column_name in ('plan', 'stripe_customer_id', 'stripe_subscription_id', 'subscription_status')
    `,
    [],
  )) as Array<{ column_name: string }>;
  const set = new Set(rows.map((row) => row.column_name));
  return {
    hasPlan: set.has('plan'),
    hasStripeCustomerId: set.has('stripe_customer_id'),
    hasStripeSubscriptionId: set.has('stripe_subscription_id'),
    hasSubscriptionStatus: set.has('subscription_status'),
  };
}

async function resolveWorkspaceForUser(input: {
  metadataWorkspaceId: string | null;
}): Promise<{
  workspaceId: string | null;
  strategy: 'metadata.workspaceId' | 'active_workspace' | 'none';
}> {
  if (input.metadataWorkspaceId) {
    return {
      workspaceId: input.metadataWorkspaceId,
      strategy: 'metadata.workspaceId',
    };
  }

  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    return {
      workspaceId: context.workspaceId,
      strategy: 'active_workspace',
    };
  } catch {
    return {
      workspaceId: null,
      strategy: 'none',
    };
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = reconcileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { sessionId, subscriptionId } = parsed.data;
  const userEmail = session?.user?.email?.trim().toLowerCase() ?? null;

  let checkoutSession: Stripe.Checkout.Session | null = null;
  let subscription: Stripe.Subscription | null = null;

  if (sessionId) {
    checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price.product', 'customer'],
    });

    if (
      checkoutSession.mode !== 'subscription' ||
      checkoutSession.payment_status !== 'paid' ||
      !checkoutSession.subscription
    ) {
      return NextResponse.json(
        { ok: false, code: 'SESSION_NOT_PAID_SUBSCRIPTION' },
        { status: 200 },
      );
    }

    subscription =
      typeof checkoutSession.subscription === 'string'
        ? await stripe.subscriptions.retrieve(checkoutSession.subscription, {
            expand: ['items.data.price.product', 'customer'],
          })
        : checkoutSession.subscription;
  } else if (subscriptionId) {
    subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product', 'customer'],
    });
  }

  if (!subscription) {
    return NextResponse.json({ ok: false, code: 'SUBSCRIPTION_NOT_FOUND' }, { status: 200 });
  }

  const metadataWorkspaceId =
    checkoutSession?.metadata?.workspaceId?.trim() ||
    subscription.metadata?.workspaceId?.trim() ||
    null;
  const workspaceResolution = await resolveWorkspaceForUser({ metadataWorkspaceId });
  const workspaceId = workspaceResolution.workspaceId;

  if (!workspaceId) {
    console.warn('[stripe reconcile] workspace resolution failed', {
      source: 'manual_reconcile',
      eventType: 'manual_reconcile',
      sessionId: sessionId ?? null,
      subscriptionId: subscription.id,
      strategy: workspaceResolution.strategy,
      metadataWorkspaceId: metadataWorkspaceId ?? null,
    });
    return NextResponse.json(
      { ok: false, code: 'WORKSPACE_RESOLUTION_FAILED' },
      { status: 200 },
    );
  }

  const firstPrice = subscription.items.data[0]?.price;
  const plan = resolvePaidPlanFromStripe({
    metadataPlan: subscription.metadata?.plan ?? checkoutSession?.metadata?.plan ?? null,
    priceId: firstPrice?.id ?? null,
    productId: parseStripeId(firstPrice?.product),
    productMetadataPlan: readProductPlan(firstPrice?.product),
  });

  if (!plan) {
    return NextResponse.json({ ok: false, code: 'PLAN_RESOLUTION_FAILED' }, { status: 200 });
  }

  const customerId = parseStripeId(subscription.customer);
  const status = String(subscription.status).trim().toLowerCase();
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end || subscription.cancel_at);
  const currentPeriodEndUnix =
    (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end ??
    subscription.cancel_at ??
    null;
  const currentPeriodEnd =
    typeof currentPeriodEndUnix === 'number'
      ? new Date(currentPeriodEndUnix * 1000)
      : null;
  const dedupeKey = `manual_reconcile:${sessionId ?? subscription.id}`;

  const result = await sql.begin(async (tx) => {
    const inserted = (await tx.unsafe(
      `
        insert into public.billing_events (
          workspace_id,
          user_email,
          event_type,
          stripe_event_id,
          stripe_object_id,
          status,
          meta
        )
        values (
          $1,
          $2,
          'manual_reconcile',
          $3,
          $4,
          $5,
          $6::jsonb
        )
        on conflict do nothing
        returning id
      `,
      [workspaceId, userEmail, dedupeKey, subscription.id, status, JSON.stringify({ source: 'manual_reconcile' })],
    )) as Array<{ id: string }>;

    if (inserted.length === 0) {
      const current = (await tx.unsafe(
        `
          select u.plan
          from public.workspaces w
          join public.users u on u.id = w.owner_user_id
          where w.id = $1
          limit 1
        `,
        [workspaceId],
      )) as Array<{ plan: string | null }>;
      return {
        deduped: true,
        currentPlan: current[0]?.plan ?? plan,
      };
    }

    await tx.unsafe(
      `
        update public.users u
        set
          plan = $1,
          is_pro = true,
          stripe_customer_id = coalesce($2, u.stripe_customer_id),
          stripe_subscription_id = $3,
          subscription_status = $4,
          cancel_at_period_end = $5,
          current_period_end = $6
        from public.workspaces w
        where w.id = $7
          and u.id = w.owner_user_id
      `,
      [plan, customerId, subscription.id, status, cancelAtPeriodEnd, currentPeriodEnd, workspaceId],
    );

    const columns = await readWorkspaceBillingColumns(tx);
    if (columns.hasPlan) {
      await tx.unsafe(
        `
          update public.workspaces
          set plan = $1
          where id = $2
        `,
        [plan, workspaceId],
      );
    }
    if (columns.hasStripeCustomerId) {
      await tx.unsafe(
        `
          update public.workspaces
          set stripe_customer_id = coalesce($1, stripe_customer_id)
          where id = $2
        `,
        [customerId, workspaceId],
      );
    }
    if (columns.hasStripeSubscriptionId) {
      await tx.unsafe(
        `
          update public.workspaces
          set stripe_subscription_id = $1
          where id = $2
        `,
        [subscription.id, workspaceId],
      );
    }
    if (columns.hasSubscriptionStatus) {
      await tx.unsafe(
        `
          update public.workspaces
          set subscription_status = $1
          where id = $2
        `,
        [status, workspaceId],
      );
    }

    await tx.unsafe(
      `
        update public.billing_events
        set
          workspace_id = $1,
          status = $2,
          meta = coalesce(meta, '{}'::jsonb) || $3::jsonb
        where stripe_event_id = $4
      `,
      [
        workspaceId,
        status,
        JSON.stringify({
          source: 'manual_reconcile',
          plan,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
        }),
        dedupeKey,
      ],
    );

    return {
      deduped: false,
      currentPlan: plan,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      plan: result.currentPlan,
      workspaceId,
      stripe: {
        customer: customerId,
        subscription: subscription.id,
      },
      source: 'manual_reconcile',
      deduped: result.deduped,
    },
    { status: 200 },
  );
}
