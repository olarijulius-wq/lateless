'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { primaryButtonClasses, secondaryButtonClasses } from '@/app/ui/button';
import { DASHBOARD_SETUP_HIDDEN_KEY } from '@/app/ui/dashboard/setup-visibility';

const LAST_SEEN_STEP_KEY = 'lateless.onboarding.lastSeenStep';

export type OnboardingStep = {
  key: 'company' | 'customer' | 'invoice' | 'send' | 'payouts';
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  done: boolean;
};

function clampIndex(value: number, max: number) {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

export default function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const firstIncompleteIndex = useMemo(() => {
    const index = steps.findIndex((step) => !step.done);
    return index === -1 ? 0 : index;
  }, [steps]);
  const [expandedIndex, setExpandedIndex] = useState(() => {
    if (typeof window === 'undefined') {
      return firstIncompleteIndex;
    }
    const fromStorage = window.localStorage.getItem(LAST_SEEN_STEP_KEY);
    const parsed = Number(fromStorage);
    return Number.isFinite(parsed)
      ? clampIndex(Math.floor(parsed), Math.max(steps.length - 1, 0))
      : firstIncompleteIndex;
  });
  const [dashboardSetupHidden, setDashboardSetupHidden] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(DASHBOARD_SETUP_HIDDEN_KEY) === '1';
  });

  const doneCount = steps.filter((step) => step.done).length;

  function toggleExpanded(index: number) {
    const nextIndex = expandedIndex === index ? -1 : index;
    setExpandedIndex(nextIndex);
    if (nextIndex >= 0) {
      window.localStorage.setItem(LAST_SEEN_STEP_KEY, String(nextIndex));
    }
  }

  function hideSetupOnDashboard() {
    window.localStorage.setItem(DASHBOARD_SETUP_HIDDEN_KEY, '1');
    setDashboardSetupHidden(true);
  }

  function showSetupOnDashboard() {
    window.localStorage.removeItem(DASHBOARD_SETUP_HIDDEN_KEY);
    setDashboardSetupHidden(false);
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-900 dark:bg-neutral-950">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Setup</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {doneCount}/{steps.length} steps done.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dashboardSetupHidden ? (
            <button
              type="button"
              onClick={showSetupOnDashboard}
              className={`${secondaryButtonClasses} h-9 px-3 text-sm`}
            >
              Show setup on dashboard
            </button>
          ) : (
            <button
              type="button"
              onClick={hideSetupOnDashboard}
              className={`${secondaryButtonClasses} h-9 px-3 text-sm`}
            >
              Hide setup on dashboard
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {steps.map((step, index) => {
          const expanded = expandedIndex === index;
          return (
            <article
              key={step.key}
              className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Step {index + 1}
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{step.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                      step.done
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
                    }`}
                  >
                    {step.done ? 'Done' : 'Not done'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(index)}
                    className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {expanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>

              {expanded ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{step.description}</p>
                  <Link href={step.href} className={`${primaryButtonClasses} h-9 px-3 text-sm`}>
                    {step.ctaLabel}
                  </Link>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
