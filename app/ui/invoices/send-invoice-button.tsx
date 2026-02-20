'use client';

import { useMemo, useState } from 'react';
import { primaryButtonClasses, secondaryButtonClasses } from '@/app/ui/button';

type SendInvoiceButtonProps = {
  invoiceId: string;
  returnTo?: string;
  compact?: boolean;
  onSent?: (input: { invoiceId: string; sentAt: string }) => void;
  initialStatus?: string | null;
  initialSentAt?: string | null;
  initialError?: string | null;
};

type SendInvoiceResponse = {
  ok?: boolean;
  sentAt?: string;
  error?: string;
  code?: string;
  actionUrl?: string;
  actionHint?: string;
};

function formatSentAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function SendInvoiceButton({
  invoiceId,
  returnTo,
  compact = false,
  onSent,
  initialStatus,
  initialSentAt,
  initialError,
}: SendInvoiceButtonProps) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [sentAt, setSentAt] = useState<string | null>(initialSentAt ?? null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [actionUrl, setActionUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const sentLabel = useMemo(() => formatSentAt(sentAt), [sentAt]);

  async function handleSend() {
    if (isSending) return;
    setIsSending(true);
    setError(null);
    setActionUrl(null);

    const url = new URL(`/api/invoices/${invoiceId}/send`, window.location.origin);
    if (returnTo) url.searchParams.set('returnTo', returnTo);

    try {
      const response = await fetch(url.toString(), { method: 'POST' });
      const payload = (await response.json().catch(() => null)) as SendInvoiceResponse | null;

      if (!response.ok || !payload?.ok) {
        setStatus('failed');
        setError(payload?.error ?? payload?.actionHint ?? 'Failed to send invoice email.');
        setActionUrl(payload?.actionUrl ?? null);
        return;
      }

      const nextSentAt = payload.sentAt ?? new Date().toISOString();
      setStatus('sent');
      setSentAt(nextSentAt);
      setError(null);
      if (onSent) {
        onSent({ invoiceId, sentAt: nextSentAt });
      }
    } catch {
      setStatus('failed');
      setError('Network error while sending invoice email.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <button
        type="button"
        onClick={handleSend}
        disabled={isSending}
        className={compact ? `${primaryButtonClasses} h-9 px-2 text-xs` : `${primaryButtonClasses} h-9 px-3`}
      >
        {isSending ? 'Sending…' : status === 'sent' ? 'Sent' : 'Send invoice'}
      </button>

      {status === 'sent' && sentLabel ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">Sent {sentLabel}</p>
      ) : null}

      {error ? (
        <div className="space-y-2">
          <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              className={`${secondaryButtonClasses} h-8 px-2 text-xs`}
            >
              Retry
            </button>
            {actionUrl ? (
              <a
                href={actionUrl}
                className={`${secondaryButtonClasses} h-8 px-2 text-xs`}
              >
                Fix customer
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
