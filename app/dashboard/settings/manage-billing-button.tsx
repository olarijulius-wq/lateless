'use client';

import { useState } from 'react';
import { Button } from '@/app/ui/button';

export default function ManageBillingButton({
  label = 'Manage billing / Cancel',
}: {
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);

    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data?.error ?? 'Failed to open billing portal.');
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div className="w-full">
      <Button
        type="button"
        onClick={openPortal}
        aria-disabled={loading}
        className="w-full rounded-full"
      >
        {loading ? 'Opening Billing Portal…' : label}
      </Button>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
