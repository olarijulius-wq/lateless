'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  type PasswordResetRequestState,
  requestPasswordReset,
} from '@/app/lib/actions';
import { Button } from '@/app/ui/button';
import authInputStyles from '@/app/(auth)/_components/auth-inputs.module.css';

export default function ForgotPasswordForm() {
  const initialState: PasswordResetRequestState = { message: null };
  const [state, formAction] = useActionState(
    requestPasswordReset,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-xs font-medium text-zinc-700 dark:text-white/80"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={`${authInputStyles.authInput} block w-full rounded-xl border border-zinc-300 bg-white px-3 py-[11px] text-sm text-zinc-900 outline-none placeholder:text-zinc-400 transition focus:border-zinc-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/20 dark:focus:ring-emerald-500/30`}
          placeholder="you@example.com"
        />
      </div>

      {state.message ? (
        <p className="text-sm text-zinc-600 dark:text-white/70" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-11 w-full border-zinc-300 bg-white text-zinc-950 shadow-[0_10px_24px_rgba(0,0,0,0.12)] hover:border-zinc-400 hover:bg-white hover:shadow-[0_12px_26px_rgba(0,0,0,0.14)] focus-visible:ring-emerald-500/35 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)] dark:hover:bg-zinc-800 dark:focus-visible:ring-emerald-500/40"
      >
        Send reset link
      </Button>

      <p className="text-center text-sm text-zinc-600 dark:text-white/70">
        Remembered it?{' '}
        <Link href="/login" className="text-zinc-900 hover:text-zinc-700 dark:text-white dark:hover:text-white/90">
          Back to login
        </Link>
      </p>
    </form>
  );
}
