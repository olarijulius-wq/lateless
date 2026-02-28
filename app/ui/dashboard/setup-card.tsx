'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { primaryButtonClasses, secondaryButtonClasses } from '@/app/ui/button';
import { CARD_INTERACTIVE, LIGHT_SURFACE } from '@/app/ui/theme/tokens';
import { DASHBOARD_SETUP_HIDDEN_KEY } from '@/app/ui/dashboard/setup-visibility';

type SetupItem = {
  key: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  done: boolean;
};

export default function DashboardSetupCard({ items }: { items: SetupItem[] }) {
  const doneCount = useMemo(() => items.filter((item) => item.done).length, [items]);
  const allDone = doneCount >= items.length;
  const [hiddenOverride, setHiddenOverride] = useState<boolean | null>(null);
  const hiddenFromStorage = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange);
      return () => window.removeEventListener('storage', onStoreChange);
    },
    () => window.localStorage.getItem(DASHBOARD_SETUP_HIDDEN_KEY) === '1',
    () => false,
  );
  const hidden = allDone || hiddenOverride || (hiddenOverride === null && hiddenFromStorage);

  const hideSetup = () => {
    setHiddenOverride(true);
    window.localStorage.setItem(DASHBOARD_SETUP_HIDDEN_KEY, '1');
  };

  const showSetup = () => {
    setHiddenOverride(false);
    window.localStorage.removeItem(DASHBOARD_SETUP_HIDDEN_KEY);
  };

  return (
    <>
      <section
        className={`hidden rounded-2xl border p-5 md:block ${LIGHT_SURFACE} ${CARD_INTERACTIVE} dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Quick Setup
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {doneCount}/{items.length} done
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hidden ? (
              <button type="button" onClick={showSetup} className={`${secondaryButtonClasses} h-9 px-3 text-sm`}>
                Show setup
              </button>
            ) : (
              <button type="button" onClick={hideSetup} className={`${secondaryButtonClasses} h-9 px-3 text-sm`}>
                Hide setup
              </button>
            )}
            <Link href="/dashboard/onboarding" className={`${primaryButtonClasses} h-9 px-3 text-sm`}>
              Continue setup
            </Link>
          </div>
        </div>
        {!hidden ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {item.description}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.done
                        ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
                    }`}
                  >
                    {item.done ? 'Done' : 'Not done'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Setup hidden. Use Show setup to bring back the checklist.
          </p>
        )}
      </section>

      <div className="fixed bottom-5 right-5 z-40 md:hidden">
        <div className="flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-2 shadow-lg dark:border-neutral-800 dark:bg-black">
          {allDone ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-300">Setup complete</span>
          ) : hidden ? (
            <span className="text-xs text-slate-600 dark:text-slate-300">Setup hidden</span>
          ) : (
            <span className="text-xs text-slate-600 dark:text-slate-300">Setup in progress</span>
          )}
          {hidden ? (
            <button type="button" onClick={showSetup} className={`${secondaryButtonClasses} h-7 px-2 text-xs`}>
              Show
            </button>
          ) : (
            <button type="button" onClick={hideSetup} className={`${secondaryButtonClasses} h-7 px-2 text-xs`}>
              Hide
            </button>
          )}
          <Link href="/dashboard/onboarding" className={`${primaryButtonClasses} h-7 px-2 text-xs`}>
            Setup
          </Link>
        </div>
      </div>
    </>
  );
}
