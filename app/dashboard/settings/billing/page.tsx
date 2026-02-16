import { Metadata } from 'next';
import Link from 'next/link';
import UpgradeButton from '../upgrade-button';
import ManageBillingButton from '../manage-billing-button';
import ConnectStripeButton from '../connect-stripe-button';
import {
  fetchStripeConnectStatusForUser,
  fetchUserPlanAndUsage,
  requireUserEmail,
  type StripeConnectStatus,
} from '@/app/lib/data';
import { PLAN_CONFIG, type PlanId } from '@/app/lib/config';
import { primaryButtonClasses, secondaryButtonClasses } from '@/app/ui/button';

export const metadata: Metadata = {
  title: 'Billing Settings',
};

function formatEtDateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Tallinn',
  }).format(d);
}

export default async function BillingSettingsPage(props: {
  searchParams?: Promise<{
    success?: string;
    canceled?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const success = searchParams?.success === '1';
  const canceled = searchParams?.canceled === '1';
  const userEmail = await requireUserEmail();

  const {
    plan,
    isPro,
    subscriptionStatus,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    invoiceCount,
    maxPerMonth,
  } = await fetchUserPlanAndUsage();
  const connectStatus: StripeConnectStatus =
    await fetchStripeConnectStatusForUser(userEmail);

  const periodEndLabel = formatEtDateTime(currentPeriodEnd);
  const planConfig = PLAN_CONFIG[plan];
  const isUnlimited = !Number.isFinite(planConfig.maxPerMonth);
  const connectStatusPill: {
    label: string;
    className: string;
  } | null =
    connectStatus.isReadyForTransfers
      ? {
          label: 'Payouts active',
          className:
            'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
        }
      : connectStatus.hasAccount
        ? {
            label: 'Connected, verification pending',
            className:
              'border border-amber-500/40 bg-amber-500/10 text-amber-200',
          }
        : null;

  const planCards: Array<{
    id: Exclude<PlanId, 'free'>;
    title: string;
    price: string;
    highlight: string;
    description: string;
  }> = [
    {
      id: 'solo',
      title: 'Solo',
      price: '29€/month',
      highlight: 'Up to 50 invoices/month',
      description: 'For freelancers who want hands-off reminders.',
    },
    {
      id: 'pro',
      title: 'Pro',
      price: '59€/month',
      highlight: 'Up to 250 invoices/month',
      description: 'For growing teams with recurring clients.',
    },
    {
      id: 'studio',
      title: 'Studio',
      price: '199€/month',
      highlight: 'Unlimited invoices',
      description: 'For agencies managing multiple retainers.',
    },
  ];

  return (
    <div className="space-y-6">
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
          Payment successful. Your plan is updated.
        </div>
      )}

      {canceled && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          Payment canceled.
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Current plan
        </h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          Plan:{' '}
          <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {planConfig.name}
          </span>
        </p>

        {isUnlimited ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            You can create unlimited invoices each month.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            This month: {invoiceCount} / {maxPerMonth} invoices used.
          </p>
        )}

        {subscriptionStatus && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            Subscription status: {subscriptionStatus}
          </p>
        )}

        {plan !== 'free' && periodEndLabel && (
          <>
            {cancelAtPeriodEnd ? (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
                <p className="text-sm font-semibold">Cancellation scheduled</p>
                <p className="mt-1 text-sm text-amber-100/90">
                  Your access stays active until{' '}
                  <span className="font-semibold">{periodEndLabel}</span>.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                Next renewal: {periodEndLabel}
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid gap-3">
        {planCards.map((planCard) => {
          const isCurrent = plan === planCard.id && isPro;
          return (
            <div
              key={planCard.id}
            className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {planCard.title}
                    </h3>
                    {isCurrent && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                        Current plan
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {planCard.description}
                  </p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    {planCard.highlight}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {planCard.price}
                  </p>
                  <UpgradeButton
                    plan={planCard.id}
                    label={
                      isCurrent ? 'Current plan' : `Choose ${planCard.title}`
                    }
                    disabled={isCurrent}
                    className={
                      isCurrent
                        ? `${secondaryButtonClasses} cursor-not-allowed border-slate-500 bg-slate-500 text-slate-100 opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300`
                        : primaryButtonClasses
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        <ManageBillingButton />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Use “Manage billing / Cancel” to cancel your subscription, update
          payment method, or view invoices.
        </p>
      </div>

      {!connectStatus.hasAccount && (
        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Connect your Stripe account to receive payouts directly.
          </p>
          <ConnectStripeButton />
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Stripe payouts
        </h2>

        {!connectStatus.hasAccount ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You haven&apos;t connected Stripe payouts yet.
          </p>
        ) : (
          <>
            <div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${connectStatusPill?.className ?? ''}`}
              >
                {connectStatusPill?.label}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {connectStatus.isReadyForTransfers
                ? 'Payouts are enabled. Open Stripe Express dashboard for payout activity.'
                : 'Stripe account connected, payouts pending verification in Stripe.'}
            </p>
          </>
        )}

        <Link
          href="/dashboard/settings/payouts"
          className={primaryButtonClasses}
        >
          Open payouts
        </Link>
      </div>
    </div>
  );
}
