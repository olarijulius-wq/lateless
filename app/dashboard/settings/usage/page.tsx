import { Metadata } from 'next';
import { fetchUserPlanAndUsage } from '@/app/lib/data';
import { PLAN_CONFIG } from '@/app/lib/config';

export const metadata: Metadata = {
  title: 'Usage Settings',
};

export default async function UsageSettingsPage() {
  const usage = await fetchUserPlanAndUsage();
  const plan = PLAN_CONFIG[usage.plan];
  const isUnlimited = !Number.isFinite(usage.maxPerMonth);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Usage
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Usage and limits overview.
      </p>
      <div className="mt-4 space-y-1 text-sm text-slate-700 dark:text-slate-300">
        <p>Current plan: {plan.name}</p>
        {isUnlimited ? (
          <p>Monthly invoice limit: Unlimited</p>
        ) : (
          <p>
            Monthly invoices used: {usage.invoiceCount} / {usage.maxPerMonth}
          </p>
        )}
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
        Detailed usage analytics coming soon.
      </p>
    </div>
  );
}
