'use client';

import { useState } from 'react';
import { Button } from '@/app/ui/button';

export default function ConnectStripeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startOnboarding() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to start onboarding.');
      }

      if (!data?.url) {
        throw new Error('Missing onboarding URL.');
      }

      window.location.href = data.url;
    } catch (err: any) {
      setLoading(false);
      setError(err?.message ?? 'Something went wrong.');
    }
  }

  return (
    <div className="w-full">
      <Button
        type="button"
        onClick={startOnboarding}
        aria-disabled={loading}
        className="w-full"
      >
        {loading ? 'Redirecting to Stripe...' : 'Connect Stripe'}
      </Button>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
