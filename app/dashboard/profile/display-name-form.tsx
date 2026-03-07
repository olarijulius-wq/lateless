'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/ui/button';
import {
  updateDisplayName,
  type UpdateDisplayNameState,
} from '@/app/lib/actions';

const initialState: UpdateDisplayNameState = {
  message: '',
};

const inputClasses =
  'mt-3 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 transition focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/30 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';

export default function DisplayNameForm({
  initialName,
}: {
  initialName: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateDisplayName, initialState);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (state.message) {
      router.refresh();
    }
  }, [router, state.message]);

  return (
    <form action={formAction} className="mt-3">
      <label htmlFor="display-name" className="text-sm font-medium text-slate-900 dark:text-slate-100">
        Display name
      </label>
      <input
        id="display-name"
        name="name"
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={inputClasses}
        maxLength={120}
        autoComplete="name"
      />
      {state.error ? (
        <p className="mt-2 text-sm text-red-500">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p>
      ) : null}
      <div className="mt-3">
        <Button type="submit" className="px-4" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save name'}
        </Button>
      </div>
    </form>
  );
}
