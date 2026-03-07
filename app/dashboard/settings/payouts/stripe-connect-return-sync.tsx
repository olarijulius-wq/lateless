'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StripeConnectReturnSync({
  enabled,
}: {
  enabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function syncStatus() {
      try {
        const res = await fetch('/api/stripe/connect-resync', { method: 'POST' });
        const data = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? 'Failed to sync Stripe Connect status.');
        }

        if (!cancelled) {
          router.replace('/dashboard/settings/payouts');
          router.refresh();
        }
      } catch (syncError: unknown) {
        if (!cancelled) {
          setError(
            syncError instanceof Error
              ? syncError.message
              : 'Failed to sync Stripe Connect status.',
          );
        }
      }
    }

    void syncStatus();

    return () => {
      cancelled = true;
    };
  }, [enabled, router]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:text-slate-200 dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
      {error ?? 'Refreshing Stripe connection status...'}
    </div>
  );
}
