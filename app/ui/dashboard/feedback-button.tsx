'use client';

import { useMemo, useState } from 'react';
import { Button, secondaryButtonClasses, toolbarButtonClasses } from '@/app/ui/button';

type ApiResult = {
  ok?: boolean;
  message?: string;
  code?: string;
};

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const trimmedMessage = useMemo(() => message.trim(), [message]);

  const closeModal = () => {
    if (submitting) return;
    setOpen(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  async function handleSubmit() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!trimmedMessage) {
      setErrorMessage('Please write a short feedback message.');
      return;
    }

    if (trimmedMessage.length > 2000) {
      setErrorMessage('Feedback must be 2000 characters or less.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmedMessage,
          pagePath: window.location.pathname,
        }),
      });

      const payload = (await response.json()) as ApiResult;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Could not send feedback.');
      }

      setSuccessMessage('Sent. Thank you.');
      setMessage('');
      window.setTimeout(() => {
        setOpen(false);
        setSuccessMessage(null);
      }, 800);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not send feedback.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${toolbarButtonClasses} h-9 px-3 text-xs`}
      >
        Feedback
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.14)] dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-[0_18px_35px_rgba(0,0,0,0.55)]">
            <h2
              id="feedback-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Feedback
            </h2>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              What should we improve?
            </p>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What should we improve?"
              maxLength={2000}
              rows={6}
              className="mt-3 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-slate-100 dark:focus:border-neutral-500 dark:focus:ring-2 dark:focus:ring-neutral-500/25"
            />
            <p className="mt-1 text-right text-xs text-slate-500 dark:text-slate-400">
              {trimmedMessage.length}/2000
            </p>

            {errorMessage ? (
              <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                {successMessage}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className={`${secondaryButtonClasses} border-neutral-900/30 bg-white text-slate-900 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-transparent dark:text-slate-100 dark:hover:bg-neutral-900`}
              >
                Cancel
              </button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
