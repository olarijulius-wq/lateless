'use client';

import clsx from 'clsx';
import { useState } from 'react';

type PublicPayButtonProps = {
  token: string;
  className?: string;
};

export default function PublicPayButton({
  token,
  className,
}: PublicPayButtonProps) {
  const payNowButtonClasses =
    'inline-flex items-center justify-center rounded-xl border border-emerald-700 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-emerald-700 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-emerald-400/40 dark:bg-black dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-60';
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const response = await fetch(`/api/public/invoices/${token}/pay`, {
        method: 'POST',
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to start payment');
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error('Missing Stripe Checkout URL');
    } catch (error) {
      console.error('Pay now failed:', error);
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={clsx(payNowButtonClasses, className)}
    >
      {isLoading ? 'Redirecting...' : 'Pay now'}
    </button>
  );
}
