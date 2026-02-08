'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/ui/button';

export default function ResyncConnectStatusButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resyncStatus() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/connect-resync', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? 'Failed to sync Stripe Connect status.');
      }

      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to sync Stripe Connect status.');
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  return (
    <div className="w-full">
      <Button
        type="button"
        onClick={resyncStatus}
        aria-disabled={loading}
        className="w-full"
      >
        {loading ? 'Syncing...' : 'Re-sync status from Stripe'}
      </Button>
      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
    </div>
  );
}
