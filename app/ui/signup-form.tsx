'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/app/ui/button';
import { registerUser, SignupState } from '@/app/lib/actions';

export default function SignupForm() {
  const initialState: SignupState = { message: null, errors: {} };
  const [state, formAction] = useActionState(registerUser, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Name
        </label>
        <input
          name="name"
          type="text"
          className="block w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
          placeholder="Your name"
        />
        {state.errors?.name?.map((e) => (
          <p key={e} className="mt-2 text-sm text-red-500">{e}</p>
        ))}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Email
        </label>
        <input
          name="email"
          type="email"
          className="block w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
          placeholder="you@example.com"
        />
        {state.errors?.email?.map((e) => (
          <p key={e} className="mt-2 text-sm text-red-500">{e}</p>
        ))}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Password
        </label>
        <input
          name="password"
          type="password"
          className="block w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
          placeholder="At least 8 characters"
        />
        {state.errors?.password?.map((e) => (
          <p key={e} className="mt-2 text-sm text-red-500">{e}</p>
        ))}
      </div>

      {state.message && (
        <p className="text-sm text-red-500">{state.message}</p>
      )}

      <Button type="submit" className="w-full">
        Create account
      </Button>

      <p className="text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link href="/login" className="text-sky-300 hover:text-sky-200">
          Log in
        </Link>
      </p>
    </form>
  );
}