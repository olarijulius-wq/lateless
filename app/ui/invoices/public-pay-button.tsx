'use client';

import clsx from 'clsx';
import { useState } from 'react';
import { payNowButtonClasses } from '@/app/ui/button';

type PublicPayButtonProps = {
  token: string;
  disabled?: boolean;
  className?: string;
};

export default function PublicPayButton({
  token,
  disabled = false,
  className,
}: PublicPayButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    if (isLoading || disabled) return;
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
      disabled={disabled || isLoading}
      className={clsx(payNowButtonClasses, className)}
    >
      {isLoading ? 'Redirecting...' : 'Pay now'}
    </button>
  );
}
