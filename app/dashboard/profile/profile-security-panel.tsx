'use client';

import { FormEvent, useState } from 'react';
import { signOut } from 'next-auth/react';
import { Button, primaryButtonClasses } from '@/app/ui/button';
import { NEUTRAL_FOCUS_RING_CLASSES } from '@/app/ui/dashboard/neutral-interaction';
import { getPasswordCtaCopy } from './password-cta';

type ApiResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
};

type EmailPasswordPanelProps = {
  email: string;
  connectedOnLabel: string;
  hasPassword: boolean;
};

const profileInputClasses = `block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 transition dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 ${NEUTRAL_FOCUS_RING_CLASSES}`;

export function EmailPasswordPanel({
  email,
  connectedOnLabel,
  hasPassword,
}: EmailPasswordPanelProps) {
  const [resetPending, setResetPending] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const ctaCopy = getPasswordCtaCopy(hasPassword);

  async function handleSendResetLink() {
    setResetPending(true);
    setResetMessage(null);

    try {
      const response = await fetch('/api/account/password-reset', {
        method: 'POST',
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || !payload?.ok) {
        if (payload?.code === 'RATE_LIMITED') {
          setResetMessage({
            ok: false,
            text: 'Too many requests. Please wait a few minutes and try again.',
          });
          return;
        }

        setResetMessage({
          ok: false,
          text: payload?.message ?? 'Could not send password reset email. Try again.',
        });
        return;
      }

      setResetMessage({
        ok: true,
        text: ctaCopy.successMessage(email),
      });
    } catch {
      setResetMessage({
        ok: false,
        text: 'Could not send password reset email. Try again.',
      });
    } finally {
      setResetPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Email &amp; Password
          </h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{email}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Connected on {connectedOnLabel}
          </p>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
            {ctaCopy.description}
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSendResetLink}
          disabled={resetPending}
          className={`h-10 px-4 ${NEUTRAL_FOCUS_RING_CLASSES}`}
        >
          {resetPending ? 'Sending...' : ctaCopy.actionLabel}
        </Button>
      </div>
      {resetMessage ? (
        <p
          className={`text-sm ${
            resetMessage.ok
              ? 'text-neutral-700 dark:text-neutral-300'
              : 'text-rose-700 dark:text-rose-300'
          }`}
          aria-live="polite"
        >
          {resetMessage.text}
        </p>
      ) : null}
    </div>
  );
}

export function DeleteAccountForm() {
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePending, setDeletePending] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeletePending(true);
    setDeleteMessage(null);

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmText: deleteConfirmText,
          currentPassword: deletePassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || !payload?.ok) {
        setDeleteMessage({
          ok: false,
          text: payload?.message ?? 'Could not delete account.',
        });
        return;
      }

      await signOut({ callbackUrl: '/' });
    } catch {
      setDeleteMessage({ ok: false, text: 'Could not delete account.' });
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={handleDeleteAccount}>
        <div>
          <label
            className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300"
            htmlFor="deleteConfirmText"
          >
            Type DELETE to confirm
          </label>
          <input
            id="deleteConfirmText"
            type="text"
            required
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            className={profileInputClasses}
            placeholder="DELETE"
          />
        </div>

        <div>
          <label
            className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300"
            htmlFor="deleteCurrentPassword"
          >
            Current password
          </label>
          <input
            id="deleteCurrentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            className={profileInputClasses}
          />
        </div>

        <button
          type="submit"
          disabled={deletePending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-50 transition duration-200 ease-out hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 dark:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deletePending ? 'Deleting...' : 'Delete account'}
        </button>

        {deleteMessage ? (
          <p className="text-sm text-rose-700 dark:text-rose-300" aria-live="polite">
            {deleteMessage.text}
          </p>
        ) : null}
      </form>
  );
}
