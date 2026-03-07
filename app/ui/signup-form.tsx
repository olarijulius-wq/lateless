'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/ui/button';
import SocialAuthButtons from '@/app/(auth)/_components/social-auth-buttons';
import authInputStyles from '@/app/(auth)/_components/auth-inputs.module.css';
import { sanitizeRelativeCallbackPath } from '@/app/lib/auth-url';

type SignupState = {
  message: string | null;
  code?: string;
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
    termsAccepted?: string[];
  };
};

type SignupFormProps = {
  googleEnabled: boolean;
  githubEnabled: boolean;
  callbackUrl?: string | null;
};

export default function SignupForm({
  googleEnabled,
  githubEnabled,
  callbackUrl,
}: SignupFormProps) {
  const router = useRouter();
  const [state, setState] = useState<SignupState>({ message: null, errors: {} });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const lastClearedSubmit = useRef(0);
  const hasError = Boolean(
    state.message ||
      state.errors?.email?.length ||
      state.errors?.password?.length,
  );

  useEffect(() => {
    if (hasError && submitCount !== lastClearedSubmit.current) {
      lastClearedSubmit.current = submitCount;
      setPassword('');
    }
  }, [hasError, submitCount]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitCount((count) => count + 1);
    setState({ message: null, errors: {} });
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: typeof form.get('name') === 'string' ? form.get('name') : '',
      email: typeof form.get('email') === 'string' ? form.get('email') : '',
      password: typeof form.get('password') === 'string' ? form.get('password') : '',
      termsAccepted: form.get('termsAccepted') === 'on',
      callbackUrl: sanitizeRelativeCallbackPath(callbackUrl ?? '', '/dashboard'),
    };

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            code?: string;
            message?: string;
            errors?: SignupState['errors'];
          }
        | null;

      if (!response.ok || !result?.ok) {
        setState({
          message: result?.message ?? 'Failed to create your account. Please try again.',
          code: result?.code,
          errors: result?.errors ?? {},
        });
        return;
      }

      const nextLoginUrl = new URL('/login', window.location.origin);
      nextLoginUrl.searchParams.set('signup', 'success');
      const safeCallbackUrl = sanitizeRelativeCallbackPath(callbackUrl ?? '', '/dashboard');
      if (safeCallbackUrl !== '/dashboard') {
        nextLoginUrl.searchParams.set('callbackUrl', safeCallbackUrl);
      }
      router.push(`${nextLoginUrl.pathname}${nextLoginUrl.search}`);
    } catch {
      setState({
        message: 'Failed to create your account. Please try again.',
        errors: {},
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <SocialAuthButtons
        googleEnabled={googleEnabled}
        githubEnabled={githubEnabled}
        callbackUrl={callbackUrl}
      />
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-zinc-300 dark:bg-white/10" />
        <span className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-white/50">
          or
        </span>
        <span className="h-px flex-1 bg-zinc-300 dark:bg-white/10" />
      </div>

      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ''} />

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-white/80">Email</label>
        <input
          name="email"
          type="email"
          className={`${authInputStyles.authInput} block w-full rounded-xl border border-zinc-300 bg-white px-3 py-[11px] text-sm text-zinc-900 outline-none placeholder:text-zinc-400 transition focus:border-zinc-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/20 dark:focus:ring-emerald-500/30`}
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {state.errors?.email?.map((e) => (
          <p key={e} className="mt-2 text-sm text-red-600 dark:text-red-400">{e}</p>
        ))}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-white/80">Password</label>
        <input
          name="password"
          type="password"
          className={`${authInputStyles.authInput} block w-full rounded-xl border border-zinc-300 bg-white px-3 py-[11px] text-sm text-zinc-900 outline-none placeholder:text-zinc-400 transition focus:border-zinc-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/20 dark:focus:ring-emerald-500/30`}
          placeholder="At least 6 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {state.errors?.password?.map((e) => (
          <p key={e} className="mt-2 text-sm text-red-600 dark:text-red-400">{e}</p>
        ))}
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-zinc-700 dark:text-white/80">
          <input
            name="termsAccepted"
            type="checkbox"
            required
            className="mt-1 h-4 w-4 rounded border border-zinc-400 bg-white text-zinc-900 focus:ring-2 focus:ring-emerald-500/35 dark:border-white/20 dark:bg-white/5 dark:text-white dark:focus:ring-emerald-500/40"
          />
          <span>
            I agree to the{' '}
            <Link href="/legal/terms" className="text-zinc-900 underline underline-offset-4 dark:text-white">
              Terms
            </Link>{' '}
            and acknowledge the{' '}
            <Link
              href="/legal/privacy"
              className="text-zinc-900 underline underline-offset-4 dark:text-white"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {state.errors?.termsAccepted?.map((e) => (
          <p key={e} className="mt-2 text-sm text-red-600 dark:text-red-400">{e}</p>
        ))}
      </div>

      {state.message && <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full justify-start border-zinc-300 bg-white px-4 text-zinc-950 shadow-[0_10px_24px_rgba(0,0,0,0.12)] hover:border-zinc-400 hover:bg-white hover:shadow-[0_12px_26px_rgba(0,0,0,0.14)] focus-visible:ring-emerald-500/35 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)] dark:hover:bg-zinc-800 dark:focus-visible:ring-emerald-500/40"
      >
        {isSubmitting ? 'Creating account...' : 'Create account'}
        <ArrowRightIcon className="ml-auto h-5 w-5 text-current" />
      </Button>
    </form>
  );
}
