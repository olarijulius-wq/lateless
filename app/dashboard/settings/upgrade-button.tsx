'use client';

import { useState } from 'react';
import { type BillingInterval, type PlanId } from '@/app/lib/config';
import { primaryButtonClasses } from '@/app/ui/button';

type UpgradeButtonProps = {
  plan: Exclude<PlanId, 'free'>;
  label: string;
  interval?: BillingInterval;
  className?: string;
  disabled?: boolean;
};

export default function UpgradeButton({
  plan,
  label,
  interval = 'monthly',
  className,
  disabled,
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    if (disabled) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stripe/checkout?plan=${plan}&interval=${interval}`,
        {
        method: 'POST',
        },
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'Checkout failed');
      if (!data?.url) throw new Error('Missing checkout URL');

      window.location.href = data.url;
    } catch (e: any) {
      alert(e?.message || 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <button
      onClick={startCheckout}
      disabled={loading || disabled}
      className={
        className ??
        primaryButtonClasses
      }
    >
      {loading ? 'Redirecting...' : label}
    </button>
  );
}
