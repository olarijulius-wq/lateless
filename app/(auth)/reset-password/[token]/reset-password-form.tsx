'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/app/ui/button';
import { type ResetPasswordState, resetPassword } from '@/app/lib/actions';
import authInputStyles from '@/app/(auth)/_components/auth-inputs.module.css';

type ResetPasswordFormProps = {
  token: string;
};

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const initialState: ResetPasswordState = { message: null };
  const [state, formAction] = useActionState(
    resetPassword,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-xs font-medium text-zinc-700 dark:text-white/80"
        >
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={6}
          required
          autoComplete="new-password"
          className={`${authInputStyles.authInput} block w-full rounded-xl border border-zinc-300 bg-white px-3 py-[11px] text-sm text-zinc-900 outline-none placeholder:text-zinc-400 transition focus:border-zinc-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/20 dark:focus:ring-emerald-500/30`}
          placeholder="At least 6 characters"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-2 block text-xs font-medium text-zinc-700 dark:text-white/80"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={6}
          required
          autoComplete="new-password"
          className={`${authInputStyles.authInput} block w-full rounded-xl border border-zinc-300 bg-white px-3 py-[11px] text-sm text-zinc-900 outline-none placeholder:text-zinc-400 transition focus:border-zinc-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/20 dark:focus:ring-emerald-500/30`}
          placeholder="Repeat your new password"
        />
      </div>

      {state.message ? (
        <p className="text-sm text-red-600 dark:text-red-400" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-11 w-full border-zinc-300 bg-white text-zinc-950 shadow-[0_10px_24px_rgba(0,0,0,0.12)] hover:border-zinc-400 hover:bg-white hover:shadow-[0_12px_26px_rgba(0,0,0,0.14)] focus-visible:ring-emerald-500/35 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)] dark:hover:bg-zinc-800 dark:focus-visible:ring-emerald-500/40"
      >
        Set new password
      </Button>

      <p className="text-center text-sm text-zinc-600 dark:text-white/70">
        <Link href="/login" className="text-zinc-900 hover:text-zinc-700 dark:text-white dark:hover:text-white/90">
          Back to login
        </Link>
      </p>
    </form>
  );
}
