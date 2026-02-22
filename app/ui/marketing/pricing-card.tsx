import Link from 'next/link';
import clsx from 'clsx';
import type { BillingInterval, PlanConfig, PlanId } from '@/app/lib/config';
import {
  MARKETING_BODY,
  MARKETING_BUTTON_PRIMARY,
  MARKETING_BUTTON_SECONDARY,
  MARKETING_CARD_HOVER,
  MARKETING_CARD_SURFACE,
  MARKETING_EYEBROW,
} from '@/app/ui/marketing/tokens';

type PricingCardProps = {
  plan: PlanConfig;
  interval?: BillingInterval;
  displayPrice: number;
  periodLabel: string;
  callbackUrl?: string;
  annualSavingsLabel?: string;
  isPopular?: boolean;
  className?: string;
};

function formatLimit(maxPerMonth: number) {
  return Number.isFinite(maxPerMonth)
    ? `Up to ${maxPerMonth} invoices / month`
    : 'Unlimited invoices / month';
}

function formatPlatformFee(plan: PlanConfig) {
  return `€${(plan.platformFeeFixedCents / 100).toFixed(2)} + ${plan.platformFeePercent.toFixed(1)}% (cap €${(plan.platformFeeCapCents / 100).toFixed(2)}) per paid invoice`;
}

function getPlanHref(planId: PlanId, interval: BillingInterval, callbackUrl?: string) {
  if (!callbackUrl) {
    return `/login?plan=${planId}&interval=${interval}`;
  }

  return `/login?plan=${planId}&interval=${interval}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export default function PricingCard({
  plan,
  interval = 'monthly',
  displayPrice,
  periodLabel,
  callbackUrl,
  annualSavingsLabel,
  isPopular = false,
  className,
}: PricingCardProps) {
  return (
    <section
      className={clsx(
        MARKETING_CARD_SURFACE,
        MARKETING_CARD_HOVER,
        'relative flex h-full flex-col p-6',
        isPopular && 'border-[color:var(--mk-border-strong)] dark:shadow-[0_0_0_1px_rgba(16,185,129,0.24),0_24px_60px_var(--mk-shadow)]',
        className,
      )}
    >
      {isPopular ? (
        <span className="absolute right-4 top-4 rounded-full border border-[color:var(--mk-border-strong)] bg-[color:var(--mk-surface-soft)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--mk-fg-strong)] dark:bg-black dark:shadow-[0_0_14px_rgba(16,185,129,0.1)]">
          Most popular
        </span>
      ) : null}

      <p className="text-sm font-medium text-[var(--mk-fg)]">{plan.name}</p>
      <p className="mt-4 text-4xl font-medium text-[var(--mk-fg-strong)]">
        €{displayPrice}
        <span className="ml-1 text-sm font-normal text-[color:var(--mk-fg-muted)] dark:ml-2 dark:inline-flex dark:items-center dark:rounded-full dark:border dark:border-emerald-900/70 dark:bg-black dark:px-2 dark:py-0.5 dark:text-zinc-100 dark:shadow-[0_0_0_1px_rgba(16,185,129,0.18)]">
          {periodLabel}
        </span>
      </p>
      {annualSavingsLabel ? (
        <p className={`${MARKETING_EYEBROW} mt-2 text-emerald-500 dark:text-emerald-300`}>
          {annualSavingsLabel}
        </p>
      ) : null}

      <ul className={`mt-6 space-y-3 ${MARKETING_BODY}`}>
        <li className="dark:text-zinc-200">{formatLimit(plan.maxPerMonth)}</li>
        <li className="text-[color:var(--mk-fg-muted)] dark:text-zinc-300">Resets monthly. You keep your invoice history.</li>
        <li>
          Platform fee:{' '}
          <span className="text-[color:var(--mk-fg)]">{formatPlatformFee(plan)}</span>
        </li>
      </ul>

      <div className="mt-8 flex flex-1 items-end">
        <Link
          href={getPlanHref(plan.id, interval, callbackUrl)}
          className={clsx('w-full', isPopular ? MARKETING_BUTTON_PRIMARY : MARKETING_BUTTON_SECONDARY)}
        >
          Start with {plan.name}
        </Link>
      </div>
    </section>
  );
}
